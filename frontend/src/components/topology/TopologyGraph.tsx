import { Button } from "@/components/ui/button";
import { useSocket } from "@/context/socket-context";
import { useTopologyCommands } from "@/hooks/topology/useTopologyCommands";
import { determineLinkColor, processTopologyData } from "@/lib/topology-utils";
import { apiLogger } from "@/lib/logger";
import { apiService } from "@/services/api.service";
import type {
  LinkStatsUpdate,
  NetworkStatsUpdate,
  TopologyData,
} from "@/types/network";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Node } from "reactflow";
import ReactFlow, {
  Background,
  Controls,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { toast } from "sonner";
import CustomEdge from "./CustomEdge";
import { NodeConfigPanel } from "./NodeConfigPanel";
import AgentNode from "./nodes/AgentNode";

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const TopologyGraph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { socket, isConnected } = useSocket();
  const [, setPendingEdges] = useState<
    Record<string, { action: "remove" | "add"; ts: number }>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Use extracted command handlers
  const { handleNodeAction, handleEdgeAction } = useTopologyCommands();

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Process topology data using utility function
  const processTopology = useCallback(
    (data: TopologyData) => {
      const { nodes: newNodes, edges: newEdges } = processTopologyData(data, {
        handleNodeAction,
        handleEdgeAction,
      });

      setNodes((currentNodes) => {
        return newNodes.map((nn) => {
          const existing = currentNodes.find((en) => en.id === nn.id);
          if (existing) {
            return {
              ...nn,
              position: existing.position,
              data: {
                ...nn.data,
                stats: existing.data.stats,
                onAction: handleNodeAction,
              },
            };
          }
          return nn;
        });
      });

      setEdges((currentEdges) => {
        return newEdges.map((ne) => {
          const existing = currentEdges.find((ce) => ce.id === ne.id);
          if (existing && existing.data?.pending) {
            return {
              ...ne,
              data: { ...ne.data, pending: true, onAction: handleEdgeAction },
            };
          }
          return { ...ne, data: { ...ne.data, onAction: handleEdgeAction } };
        });
      });
    },
    [handleNodeAction, handleEdgeAction, setNodes, setEdges],
  );

  const processRef = useRef<((data: TopologyData) => void) | null>(null);

  useEffect(() => {
    processRef.current = processTopology;
  }, [processTopology]);

  // Subscribe to socket events
  useEffect(() => {
    // Request initial topology
    apiService
      .getTopology()
      .then((data) => processRef.current?.(data))
      .catch((err) => apiLogger.error("Failed to fetch topology:", err));

    if (!socket) return;

    const handleTopologyUpdate = (data: TopologyData) => {
      setPendingEdges({});
      processRef.current?.(data);
    };

    const handleLinkRemovedAck = (ack: {
      source?: string;
      target?: string;
      status?: string;
      message?: string;
    }) => {
      const { source, target, status, message } = ack || {};
      const edgeId = `${source}-${target}`;
      if (status === "removed") {
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.success(`Lien supprimé: ${source} → ${target}`);
      } else {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edgeId ? { ...e, data: { ...e.data, pending: false } } : e,
          ),
        );
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.error(
          `Échec suppression lien ${source} → ${target}: ${message || "Erreur"}`,
        );
      }
    };

    const handleLinkAddedAck = (ack: {
      source?: string;
      target?: string;
      status?: string;
      message?: string;
    }) => {
      const { source, target, status, message } = ack || {};
      const edgeId = `${source}-${target}`;
      if (status === "added") {
        setEdges((eds) => {
          const exists = eds.find((e) => e.id === edgeId);
          if (exists) {
            return eds.map((e) =>
              e.id === edgeId
                ? { ...e, data: { ...e.data, pending: false } }
                : e,
            );
          }
          return [
            ...eds,
            {
              id: edgeId,
              source: source as string,
              target: target as string,
              type: "custom",
              data: { onAction: handleEdgeAction, pending: false },
            },
          ];
        });
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.success(`Lien ajouté: ${source} → ${target}`);
      } else {
        setEdges((eds) =>
          eds.map((e) =>
            e.id === edgeId ? { ...e, data: { ...e.data, pending: false } } : e,
          ),
        );
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.error(
          `Échec ajout lien ${source} → ${target}: ${message || "Erreur"}`,
        );
      }
    };

    const handleNetworkStatsUpdate = (data: NetworkStatsUpdate) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === data.hostname) {
            return {
              ...node,
              data: { ...node.data, stats: data.stats },
            };
          }
          return node;
        }),
      );
    };

    const handleLinkStatsUpdate = (data: LinkStatsUpdate) => {
      const sortedIds = [data.source, data.target].sort();
      const edgeId = `${sortedIds[0]}-${sortedIds[1]}`;

      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            const newData = { ...edge.data };
            const updatedLatency = data.latency;
            const updatedLoss = data.packet_loss || 0;

            if (data.source === sortedIds[0]) {
              newData.forward = {
                ...newData.forward,
                latency: updatedLatency,
                packet_loss: updatedLoss,
              };
            } else {
              newData.backward = {
                ...newData.backward,
                latency: updatedLatency,
                packet_loss: updatedLoss,
              };
            }

            const lat1 = newData.forward?.latency || 0;
            const lat2 = newData.backward?.latency || 0;
            const maxLat = Math.max(lat1, lat2);

            const loss1 = newData.forward?.packet_loss || 0;
            const loss2 = newData.backward?.packet_loss || 0;
            const maxLoss = Math.max(loss1, loss2);

            const newColor = determineLinkColor(maxLat, maxLoss);

            return {
              ...edge,
              style: { ...edge.style, stroke: newColor },
              data: newData,
            };
          }
          return edge;
        }),
      );
    };

    socket.on("topology_update", handleTopologyUpdate);
    socket.on("link_removed_ack", handleLinkRemovedAck);
    socket.on("link_added_ack", handleLinkAddedAck);
    socket.on("network_stats_update", handleNetworkStatsUpdate);
    socket.on("link_stats_update", handleLinkStatsUpdate);

    return () => {
      socket.off("topology_update", handleTopologyUpdate);
      socket.off("link_removed_ack", handleLinkRemovedAck);
      socket.off("link_added_ack", handleLinkAddedAck);
      socket.off("network_stats_update", handleNetworkStatsUpdate);
      socket.off("link_stats_update", handleLinkStatsUpdate);
    };
  }, [socket, handleEdgeAction, setNodes, setEdges]);

  return (
    <div className="w-full h-[calc(100vh-100px)] bg-slate-50 relative rounded-xl border overflow-hidden">
      {!isConnected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500 z-50 animate-pulse" />
      )}

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-slate-50 h-full"
        style={{ height: "100%" }}
        edgesFocusable={false}
        nodesConnectable={false}
      >
        <Background />
        <Controls />
      </ReactFlow>

      <NodeConfigPanel
        isOpen={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        nodeId={selectedNodeId}
        nodeData={nodes.find((n) => n.id === selectedNodeId)?.data}
        onCommand={(cmd, params) =>
          selectedNodeId && handleNodeAction(cmd, selectedNodeId, params)
        }
      />
    </div>
  );
};

export default TopologyGraph;
