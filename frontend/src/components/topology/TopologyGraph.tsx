import { Button } from "@/components/ui/button";
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
import { useSocket } from "@/context/socket-context";
import { toast } from "sonner";
import CustomEdge from "./CustomEdge";
import AgentNode from "./nodes/AgentNode";
import { NodeConfigPanel } from "./NodeConfigPanel";
import type {
  TopologyData,
  NetworkStatsUpdate,
  LinkStatsUpdate,
  CommandParams,
  IperfClientParams,
  ChaosControlParams,
  LatencyParams,
  LossParams,
} from "@/types/network";
import { API_ENDPOINTS } from "@/config";
import { topologyLogger } from "@/lib/logger";
import {
  determineLinkColor,
  processTopologyData as processTopologyDataUtil,
} from "@/lib/topology-utils";
import { UI } from "@/lib/constants";
import { apiService } from "@/services/api.service";

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const TopologyGraph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const { socket: sharedSocket, isConnected } = useSocket();
  const [, setPendingEdges] = useState<
    Record<string, { action: "remove" | "add"; ts: number }>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Define actions using useCallback to keep reference stable
  const handleNodeAction = useCallback(
    async (action: string, nodeId: string, params?: CommandParams) => {
      topologyLogger.debug(`Node Action: ${action} on ${nodeId}`, params);

      if (action === "details") {
        toast.info(`Agent: ${nodeId}`);
        return;
      }

      try {
        if (action === "latency" && params) {
          const p = params as LatencyParams;
          const delay = p.delay || p.latency;

          if (delay) {
            await apiService.applyLatency(nodeId, String(delay));
            toast.success(`Latence de ${delay} appliquée sur ${nodeId}`);
          }
          return;
        }

        if (action === "loss" && params) {
          const p = params as LossParams;
          const loss = p.loss;
          if (loss) {
            await apiService.applyLoss(nodeId, String(loss));
            toast.success(
              `Perte de paquets de ${loss} appliquée sur ${nodeId}`,
            );
          }
          return;
        }

        if (
          action === "reset_traffic" ||
          (action === "chaos_control" &&
            params &&
            "rules" in params &&
            (params as ChaosControlParams).rules?.length === 0)
        ) {
          await apiService.clearChaos(nodeId);
          toast.success(`Règles de chaos supprimées pour ${nodeId}`);
          return;
        }

        if (action === "chaos_control" && params) {
          const p = params as ChaosControlParams;
          const rules = p.rules || [];
          const mode = p.mode || "replace";
          const iface = p.interface;

          await apiService.applyChaosConfig(nodeId, rules, iface, mode);
          toast.success(`Chaos rules applied to ${nodeId}`);
          return;
        }

        if (action === "ping") {
          await apiService.executeCommand(
            nodeId,
            "ping",
            params || { target: "8.8.8.8", count: UI.DEFAULT_PING_COUNT },
          );
          toast.info(`Ping lancé depuis ${nodeId}...`);
          return;
        } else if (action === "list_connections") {
          await apiService.executeCommand(nodeId, "list_connections", {});
          toast.info(`Liste des connexions de ${nodeId}...`);
          return;
        } else if (action === "get_network_stats") {
          await apiService.executeCommand(nodeId, "get_network_stats", {});
          toast.info(`Stats réseau de ${nodeId}...`);
          return;
        } else if (action === "get_system_stats") {
          await apiService.executeCommand(nodeId, "get_system_stats", {});
          toast.info(`Stats système de ${nodeId}...`);
          return;
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          toast.error(`Erreur: ${error.message}`);
        } else {
          toast.error("Une erreur inconnue est survenue.");
        }
        return;
      }
    },
    [],
  );

  const handleEdgeAction = useCallback(
    async (
      action: string,
      _edgeId: string,
      source: string,
      target: string,
      params?: CommandParams,
    ) => {
      topologyLogger.debug(
        `Edge Action: ${action} on ${source}->${target}`,
        params,
      );

      if (action === "iperf") {
        try {
          const iperfParams = params as IperfClientParams;
          // 1. Start Server on Target
          await apiService.executeCommand(target, "start_iperf_server", {});
          toast.info(`Starting Iperf Server on ${target}...`);

          // 2. Start Client on Source (after short delay)
          setTimeout(async () => {
            await apiService.executeCommand(source, "run_iperf_client", {
              target: target,
              duration: iperfParams?.duration || UI.DEFAULT_IPERF_DURATION,
            });
            toast.success(`Started Iperf Client on ${source} -> ${target}`);
          }, 1000);
        } catch (error) {
          toast.error(`Erreur iperf: ${error}`);
        }
      }
    },
    [],
  );

  // Re-fetch topology when socket connects/reconnects
  useEffect(() => {
    if (!isConnected) return;
    topologyLogger.info("Connected to backend, fetching topology");
    fetch(API_ENDPOINTS.topology)
      .then((res) => res.json())
      .then((data: TopologyData) => processRef.current?.(data));
  }, [isConnected]);

  // Set up socket event listeners
  useEffect(() => {
    if (!sharedSocket) return;

    const handleTopologyUpdate = (data: TopologyData) => {
      // Clear pending markers; server topology is authoritative
      setPendingEdges({});
      processRef.current?.(data);
    };

    // Acks for link operations
    const handleLinkRemovedAck = (ack: {
      source: string;
      target: string;
      status: string;
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
      source: string;
      target: string;
      status: string;
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
              source,
              target,
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

    const handleNetworkStats = (data: NetworkStatsUpdate) => {
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

    const handleLinkStats = (data: LinkStatsUpdate) => {
      const sortedIds = [data.source, data.target].sort();
      const edgeId = `${sortedIds[0]}::${sortedIds[1]}`;

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

    sharedSocket.on("topology_update", handleTopologyUpdate);
    sharedSocket.on("link_removed_ack", handleLinkRemovedAck);
    sharedSocket.on("link_added_ack", handleLinkAddedAck);
    sharedSocket.on("network_stats_update", handleNetworkStats);
    sharedSocket.on("link_stats_update", handleLinkStats);

    return () => {
      sharedSocket.off("topology_update", handleTopologyUpdate);
      sharedSocket.off("link_removed_ack", handleLinkRemovedAck);
      sharedSocket.off("link_added_ack", handleLinkAddedAck);
      sharedSocket.off("network_stats_update", handleNetworkStats);
      sharedSocket.off("link_stats_update", handleLinkStats);
    };
  }, [sharedSocket, handleEdgeAction, setEdges, setNodes, setPendingEdges]);

  const processTopologyData = useCallback(
    (data: TopologyData) => {
      if (!data.nodes) return;

      const { nodes: newNodes, edges: newEdges } = processTopologyDataUtil(
        data,
        {
          handleNodeAction,
          handleEdgeAction,
        },
      );

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
        // Preserve pending flags for edges currently in-flight if they still exist in server topology
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

  // keep ref to latest processor to avoid stale closures in socket callbacks
  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    processRef.current = processTopologyData;
  }, [processTopologyData]);

  return (
    <div className="w-full h-full bg-slate-50 relative rounded-xl border overflow-hidden">
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
        allNodes={nodes
          .filter((n) => n.id !== selectedNodeId)
          .map((n) => ({
            id: n.id,
            ip: n.data?.ip,
            hostname: n.data?.label || n.id,
          }))}
        onCommand={(cmd, params) =>
          selectedNodeId && handleNodeAction(cmd, selectedNodeId, params)
        }
      />

      {/* Command console moved to global layout */}
    </div>
  );
};

export default TopologyGraph;
