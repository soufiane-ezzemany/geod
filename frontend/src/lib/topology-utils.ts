import type { Edge, Node } from "reactflow";
import type { TopologyData, TopologyLink, CommandParams } from "@/types/network";

/**
 * Determines link color based on latency and packet loss
 */
export function determineLinkColor(latency: number, packetLoss: number = 0): string {
  if (packetLoss >= 50) return "#ef4444"; // High loss = Red
  if (packetLoss > 0) return "#f97316"; // Any loss = Orange

  if (latency < 20) return "#22c55e"; // Green
  if (latency < 100) return "#eab308"; // Yellow
  return "#ef4444"; // Red
}

type NodeActionHandler = (action: string, nodeId: string, params?: CommandParams) => void;
type EdgeActionHandler = (
  action: string,
  edgeId: string,
  source: string,
  target: string,
  params?: CommandParams
) => void;

interface ProcessTopologyOptions {
  handleNodeAction: NodeActionHandler;
  handleEdgeAction: EdgeActionHandler;
}

/**
 * Processes raw topology data into ReactFlow nodes and edges
 */
export function processTopologyData(
  data: TopologyData,
  options: ProcessTopologyOptions
): { nodes: Node[]; edges: Edge[] } {
  const { handleNodeAction, handleEdgeAction } = options;

  if (!data.nodes) {
    return { nodes: [], edges: [] };
  }

  // Create nodes
  const nodes: Node[] = data.nodes.map((n, index: number) => ({
    id: n.id,
    type: "agent",
    position: { x: 100 + index * 250, y: 100 + (index % 2) * 100 },
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
  const linkPairs = new Map<
    string,
    { forward?: TopologyLink; backward?: TopologyLink }
  >();

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

  // Create edges
  const edges: Edge[] = [];

  linkPairs.forEach((pair, key) => {
    const [source, target] = key.split("-");
    const sourceStatus = getNodeStatus(source);
    const targetStatus = getNodeStatus(target);

    const isNodesOnline = sourceStatus === "online" && targetStatus === "online";
    const isMonitoring =
      pair.forward?.monitoring !== false || pair.backward?.monitoring !== false;

    let strokeColor = isNodesOnline ? "#64748b" : "#cbd5e1";

    if (isNodesOnline && isMonitoring) {
      const latForward = pair.forward?.latency;
      const latBackward = pair.backward?.latency;

      if (latForward !== undefined || latBackward !== undefined) {
        const val1 = latForward || 0;
        const val2 = latBackward || 0;
        const maxLat = Math.max(val1, val2);

        const loss1 = pair.forward?.packet_loss || 0;
        const loss2 = pair.backward?.packet_loss || 0;
        const maxLoss = Math.max(loss1, loss2);

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
