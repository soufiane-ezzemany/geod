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
import { io, Socket } from "socket.io-client";
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
} from "@/types/network";
import { BACKEND_URL, API_ENDPOINTS } from "@/config";
import { topologyLogger } from "@/lib/logger";
import {
  determineLinkColor,
  processTopologyData as processTopologyDataUtil,
} from "@/lib/topology-utils";
import { UI } from "@/lib/constants";

const nodeTypes = {
  agent: AgentNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

const TopologyGraph = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [, setPendingEdges] = useState<
    Record<string, { action: "remove" | "add"; ts: number }>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  // Define actions using useCallback to keep reference stable
  const handleNodeAction = useCallback(
    (action: string, nodeId: string, params?: CommandParams) => {
      topologyLogger.debug(`Node Action: ${action} on ${nodeId}`, params);

      if (action === "details") {
        toast.info(`Agent: ${nodeId}`);
        return;
      }

      // The following commands require an active WebSocket connection
      if (!socket || !socket.connected) {
        toast.error("WebSocket not connected — unable to send command.");
        topologyLogger.warn(
          "Attempted command without socket connected:",
          action,
          nodeId,
        );
        return;
      }

      if (action === "ping") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "ping",
          params: params || { target: "8.8.8.8", count: UI.DEFAULT_PING_COUNT },
        });
        toast.info(`Ping lancé depuis ${nodeId}...`);
      } else if (action === "list_connections") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "list_connections",
          params: {},
        });
        toast.info(`Liste des connexions de ${nodeId}...`);
      } else if (action === "get_network_stats") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "get_network_stats",
          params: {},
        });
        toast.info(`Stats réseau de ${nodeId}...`);
      } else if (action === "get_system_stats") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "get_system_stats",
          params: {},
        });
        toast.info(`Stats système de ${nodeId}...`);

        // --- Chaos Control ---
      } else if (action === "chaos_control") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "chaos_control",
          params: params,
        });
        toast.success(`Chaos rules applied to ${nodeId}`);
      }
    },
    [socket],
  );

  const handleEdgeAction = useCallback(
    (
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
        if (!socket) {
          toast.error(
            "WebSocket not connected — impossible d'envoyer la commande.",
          );
          return;
        }
        const iperfParams = params as IperfClientParams;
        // 1. Start Server on Target
        socket.emit("trigger_command", {
          target_hostname: target,
          command: "start_iperf_server",
          params: {},
        });

        toast.info(`Starting Iperf Server on ${target}...`);

        // 2. Start Client on Source (after short delay)
        setTimeout(() => {
          socket.emit("trigger_command", {
            target_hostname: source,
            command: "run_iperf_client",
            params: {
              target: target, // Assuming DNS/hosts resolves this, otherwise we need IP
              duration: iperfParams?.duration || UI.DEFAULT_IPERF_DURATION,
            },
          });
          toast.success(`Started Iperf Client on ${source} -> ${target}`);
        }, 1000);
      }
    },
    [socket],
  );

  // Initialize Socket
  useEffect(() => {
    const newSocket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 20000,
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      topologyLogger.info("Connected to backend");
      // Request initial topology
      fetch(API_ENDPOINTS.topology)
        .then((res) => res.json())
        .then((data: TopologyData) => processRef.current?.(data));
    });

    newSocket.on("disconnect", () => setIsConnected(false));

    newSocket.on("topology_update", (data: TopologyData) => {
      // Clear pending markers; server topology is authoritative
      setPendingEdges({});
      processRef.current?.(data);
    });

    // Acks for link operations
    newSocket.on("link_removed_ack", (ack) => {
      const { source, target, status, message } = ack || {};
      const edgeId = `${source}-${target}`;
      if (status === "removed") {
        // Ensure it's removed locally and clear pending
        setEdges((eds) => eds.filter((e) => e.id !== edgeId));
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.success(`Lien supprimé: ${source} → ${target}`);
      } else {
        // Failure: clear pending flag and notify
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
    });

    newSocket.on("link_added_ack", (ack) => {
      const { source, target, status, message } = ack || {};
      const edgeId = `${source}-${target}`;
      if (status === "added") {
        // Mark not pending and ensure it's present
        setEdges((eds) => {
          const exists = eds.find((e) => e.id === edgeId);
          if (exists) {
            return eds.map((e) =>
              e.id === edgeId
                ? { ...e, data: { ...e.data, pending: false } }
                : e,
            );
          }
          // If not exists, add minimal edge (server will send topology_update soon)
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
        // Error: clear pending and notify
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
    });

    newSocket.on("network_stats_update", (data: NetworkStatsUpdate) => {
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
    });

    newSocket.on("link_stats_update", (data: LinkStatsUpdate) => {
      const sortedIds = [data.source, data.target].sort();
      const edgeId = `${sortedIds[0]}::${sortedIds[1]}`;

      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.id === edgeId) {
            // Clone data to avoid mutation
            const newData = { ...edge.data };
            const updatedLatency = data.latency;
            const updatedLoss = data.packet_loss || 0;

            // Update the specific direction stats
            if (data.source === sortedIds[0]) {
              // Forward update
              newData.forward = {
                ...newData.forward,
                latency: updatedLatency,
                packet_loss: updatedLoss,
              };
            } else {
              // Backward update
              newData.backward = {
                ...newData.backward,
                latency: updatedLatency,
                packet_loss: updatedLoss,
              };
            }

            // Recalculate color based on max latency and max loss
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
    });

    return () => {
      newSocket.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
