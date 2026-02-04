import type { TopologyData, TopologyLink } from "@/types/network";
import type { Edge, Node } from "reactflow";
import { LINK_COLORS, LINK_THRESHOLDS, TOPOLOGY } from "@/lib/constants";
import type { CommandParams } from "@/types/network";

/**
 * Determine link color based on latency and packet loss
 */
export function determineLinkColor(latency: number, packetLoss: number = 0): string {
  if (packetLoss >= LINK_THRESHOLDS.PACKET_LOSS.CRITICAL) return LINK_COLORS.RED;
  if (packetLoss > 0) return LINK_COLORS.ORANGE;

  if (latency < LINK_THRESHOLDS.LATENCY.GOOD) return LINK_COLORS.GREEN;
  if (latency < LINK_THRESHOLDS.LATENCY.WARNING) return LINK_COLORS.YELLOW;
  return LINK_COLORS.RED;
}

interface ActionHandlers {
  handleNodeAction: (action: string, nodeId: string, params?: CommandParams) => void;
  handleEdgeAction: (action: string, edgeId: string, source: string, target: string, params?: CommandParams) => void;
}

/**
 * Process topology data into React Flow nodes and edges
 */
export function processTopologyData(
  data: TopologyData,
  handlers: ActionHandlers
): { nodes: Node[]; edges: Edge[] } {
  if (!data.nodes) {
    return { nodes: [], edges: [] };
  }

  const { handleNodeAction, handleEdgeAction } = handlers;

  // Create nodes
  const nodes: Node[] = data.nodes.map((n, index: number) => ({
    id: n.id,
    type: "agent",
    position: {
      x: TOPOLOGY.NODE_START_X + index * TOPOLOGY.NODE_SPACING_X,
      y: TOPOLOGY.NODE_START_Y + (index % 2) * TOPOLOGY.NODE_SPACING_Y,
    },
    data: {
      label: n.id,
      ip: n.ip || "Unknown",
      os: (n.os as string) || "Linux",
      status: (n.status as string) || "offline",
      stats: null,
      onAction: handleNodeAction,
    },
  }));

  // Helper to find node status
  const getNodeStatus = (nodeId: string) => {
    const n = data.nodes.find((x) => x.id === nodeId);
    return n ? (n.status as string) : "offline";
  };

  // Group links by pair to create unified bidirectional edges
  const linkPairs = new Map<string, { forward?: TopologyLink; backward?: TopologyLink }>();

  data.links.forEach((l) => {
    const sortedIds = [l.source, l.target].sort();
    const pairKey = `${sortedIds[0]}-${sortedIds[1]}`;

    if (!linkPairs.has(pairKey)) {
      linkPairs.set(pairKey, {});
    }

    const entry = linkPairs.get(pairKey)!;
    if (l.source === sortedIds[0]) {
      entry.forward = l;
    } else {
      entry.backward = l;
    }
  });

  const edges: Edge[] = [];

  linkPairs.forEach((pair, key) => {
    const [source, target] = key.split("-");
    const sourceStatus = getNodeStatus(source);
    const targetStatus = getNodeStatus(target);

    const isNodesOnline = sourceStatus === "online" && targetStatus === "online";
    const isMonitoring = pair.forward?.monitoring !== false || pair.backward?.monitoring !== false;

    let strokeColor: string = isNodesOnline ? LINK_COLORS.GRAY : LINK_COLORS.LIGHT_GRAY;

    if (isNodesOnline && isMonitoring) {
      const latForward = pair.forward?.latency;
      const latBackward = pair.backward?.latency;

      if (latForward !== undefined || latBackward !== undefined) {
        const maxLat = Math.max(latForward || 0, latBackward || 0);
        const maxLoss = Math.max(pair.forward?.packet_loss || 0, pair.backward?.packet_loss || 0);
        strokeColor = determineLinkColor(maxLat, maxLoss);
      }
    }

    edges.push({
      id: key,
      source: source,
      target: target,
      type: "custom",
      animated: isNodesOnline && isMonitoring,
      style: {
        stroke: strokeColor,
        strokeWidth: 2,
        strokeDasharray: isNodesOnline ? "none" : "5,5",
        opacity: isNodesOnline ? 1 : 0.5,
      },
      data: {
        onAction: handleEdgeAction,
        forward: pair.forward,
        backward: pair.backward,
        isNodesOnline,
      },
    });
  });

  return { nodes, edges };
}
