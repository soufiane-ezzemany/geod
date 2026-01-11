import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Connection, Edge, Node } from "reactflow";
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  MarkerType,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import CustomEdge from "./CustomEdge";
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
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [pendingEdges, setPendingEdges] = useState<
    Record<string, { action: "remove" | "add"; ts: number }>
  >({});
  const [connectingInfo, setConnectingInfo] = useState<{
    nodeId?: string;
    handleType?: "source" | "target";
    handleId?: string;
  } | null>(null);

  // Define actions using useCallback to keep reference stable
  const handleNodeAction = useCallback(
    (action: string, nodeId: string, params?: any) => {
      console.log(`Node Action: ${action} on ${nodeId}`, params);

      if (action === "details") {
        toast.info(`Agent: ${nodeId}`);
        return;
      }

      // The following commands require an active WebSocket connection
      if (!socket || !socket.connected) {
        toast.error("WebSocket not connected — unable to send command.");
        console.warn("Attempted command without socket connected:", action, nodeId, params);
        return;
      }

      if (action === "ping") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "ping",
          params: params || { target: "8.8.8.8", count: 4 },
        });
        toast.info(`Ping lancé depuis ${nodeId}...`);
      } else if (action === "traceroute") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "traceroute",
          params: params || { target: "8.8.8.8" },
        });
        toast.info(`Traceroute lancé depuis ${nodeId}...`);
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
      } else if (action === "start_iperf_server") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "start_iperf_server",
          params: params || { port: 5201 },
        });
        toast.success(`Serveur Iperf démarré sur ${nodeId}`);
      } else if (action === "stop_iperf") {
        socket.emit("trigger_command", {
          target_hostname: nodeId,
          command: "stop_iperf",
          params: {},
        });
        toast.success(`Serveur Iperf arrêté sur ${nodeId}`);
      }
    },
    [socket]
  );

  const handleEdgeAction = useCallback(
    (action: string, edgeId: string, source: string, target: string, params?: any) => {
      console.log(`Edge Action: ${action} on ${source}->${target}`, params);

      if (action === "disconnect") {
        // If WebSocket connected, prefer emitting remove_link so backend will broadcast update
        if (socket && socket.connected) {
          // Find the edge object so we can restore if user clicks Undo
          const targetEdge = edges.find((e) => e.id === edgeId);
          socket.emit("remove_link", { source, target });
          // Mark edge as pending removal (don't immediately remove so user sees spinner)
          setEdges((eds) =>
            eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, pending: true } } : e))
          );
          setPendingEdges((p) => ({ ...p, [edgeId]: { action: "remove", ts: Date.now() } }));

          // Show undo toast for a few seconds
          toast(
            ({ id, update }) => (
              <div>
                Lien déconnecté: {source} → {target}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      if (socket && socket.connected) {
                        socket.emit("add_link", { source, target, data: targetEdge?.data });
                      } else {
                        // fallback REST add
                        fetch("http://localhost:5000/api/topology")
                          .then((r) => r.json())
                          .then((currentTopo) => {
                            currentTopo.links.push({ source, target, type: "manual" });
                            return fetch("http://localhost:5000/api/topology", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(currentTopo),
                            });
                          });
                      }
                      // clear pending marker and restore locally if we have the original
                      setPendingEdges((p) => {
                        const copy = { ...p };
                        delete copy[edgeId];
                        return copy;
                      });
                      if (targetEdge) {
                        setEdges((eds) =>
                          eds.map((e) =>
                            e.id === edgeId
                              ? { ...targetEdge, data: { ...targetEdge.data, pending: false } }
                              : e
                          )
                        );
                      }
                      update(id, { render: "Restauration...", icon: "↺" });
                      setTimeout(
                        () => update(id, { render: "Restauré", icon: "✅", duration: 1000 }),
                        1000
                      );
                    }}
                    className="text-sm text-primary underline"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            ),
            { duration: 8000 }
          );
          return;
        }

        // Fallback: Update backend topology via REST
        fetch("http://localhost:5000/api/topology")
          .then((res) => res.json())
          .then((currentTopo) => {
            currentTopo.links = currentTopo.links.filter(
              (l: any) => !(l.source === source && l.target === target)
            );
            return fetch("http://localhost:5000/api/topology", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(currentTopo),
            });
          })
          .then((res) => {
            if (!res.ok) throw new Error("Erreur lors de la suppression du lien");
            // For REST fallback, remove locally after confirmation
            setEdges((eds) => eds.filter((e) => e.id !== edgeId));
            toast.success(`Lien déconnecté: ${source} → ${target}`);
          })
          .catch((err) => {
            toast.error("Impossible de déconnecter le lien. Veuillez réessayer.");
            console.error(err);
          });
        return;
      }

      if (action === "bandwidth") {
        if (!socket) {
          toast.error("WebSocket not connected — impossible d'envoyer la commande.");
          return;
        }
        // Send command to source agent to limit outgoing traffic on the relevant interface
        // For MVP, we send to source and hope it knows the interface or applies globally
        // Ideally, we'd look up the interface IP matching the target IP.
        socket.emit("trigger_command", {
          target_hostname: source,
          command: "bandwidth_limit",
          params: {
            interface: "eth0", // Hardcoded for prototype; needs dynamic interface lookup
            limit: params.limit,
          },
        });
        if (params.limit === "unset") {
          toast.success(`Removed bandwidth limit between ${source} and ${target}`);
        } else {
          toast.success(`Set bandwidth limit to ${params.limit} between ${source} and ${target}`);
        }
      } else if (action === "iperf") {
        if (!socket) {
          toast.error("WebSocket not connected — impossible d'envoyer la commande.");
          return;
        }
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
              duration: params.duration || 10,
            },
          });
          toast.success(`Started Iperf Client on ${source} -> ${target}`);
        }, 1000);
      } else if (action === "latency") {
        // TC netem for latency
        // socket.emit(...)
        if (!socket) {
          toast.error("WebSocket not connected — impossible d'envoyer la commande.");
          return;
        }
        toast.info(`Set latency to ${params.delay}`);
      }
    },
    [socket]
  );

  // Initialize Socket
  useEffect(() => {
    const newSocket = io("http://localhost:5000");
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setIsConnected(true);
      console.log("Connected to backend");
      // Request initial topology
      fetch("http://localhost:5000/api/topology")
        .then((res) => res.json())
        .then((data) => processRef.current && processRef.current(data));
    });

    newSocket.on("disconnect", () => setIsConnected(false));

    newSocket.on("topology_update", (data) => {
      // Clear pending markers; server topology is authoritative
      setPendingEdges({});
      processRef.current && processRef.current(data);
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
          eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, pending: false } } : e))
        );
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.error(`Échec suppression lien ${source} → ${target}: ${message || "Erreur"}`);
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
              e.id === edgeId ? { ...e, data: { ...e.data, pending: false } } : e
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
            } as any,
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
          eds.map((e) => (e.id === edgeId ? { ...e, data: { ...e.data, pending: false } } : e))
        );
        setPendingEdges((p) => {
          const copy = { ...p };
          delete copy[edgeId];
          return copy;
        });
        toast.error(`Échec ajout lien ${source} → ${target}: ${message || "Erreur"}`);
      }
    });

    newSocket.on("network_stats_update", (data) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === data.hostname) {
            return {
              ...node,
              data: { ...node.data, stats: data.stats },
            };
          }
          return node;
        })
      );
    });

    newSocket.on("link_stats_update", (data) => {
      setEdges((eds) =>
        eds.map((edge) => {
          if (edge.source === data.source && edge.target === data.target) {
            return {
              ...edge,
              label: `${data.latency}ms`,
              animated: true,
              style: { stroke: determineLinkColor(data.latency) },
            };
          }
          return edge;
        })
      );
    });

    return () => {
      newSocket.close();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // We need to wrap processTopologyData to access the handlers
  // But handlers depend on socket which changes.
  // Better to store handlers in a ref or use the effect deps properly.
  // Actually, standard practice is to put handlers in the data object.
  // We need to re-process nodes if handlers change? No, just pass the stable function.

  // Since processTopologyData is called from socket callback, it captures the closure.
  // We'll make it a useCallback that depends on handlers.

  const processTopologyData = useCallback(
    (data: any) => {
      if (!data.nodes) return;

      const newNodes: Node[] = data.nodes.map((n: any, index: number) => ({
        id: n.id,
        type: "agent",
        position: { x: 100 + index * 250, y: 100 + (index % 2) * 100 },
        data: {
          label: n.id,
          ip: n.ip || "Unknown",
          os: n.os || "Linux",
          stats: null,
          onAction: handleNodeAction,
        },
      }));

      const newEdges: Edge[] = data.links.map((l: any) => ({
        id: `${l.source}-${l.target}`,
        source: l.source,
        target: l.target,
        type: "custom", // Use our custom edge
        label: l.latency ? `${l.latency}ms` : "Connecting...",
        animated: true,
        style: { stroke: "#94a3b8" },
        markerEnd: { type: MarkerType.ArrowClosed },
        data: {
          onAction: handleEdgeAction,
        },
      }));

      setNodes((currentNodes) => {
        return newNodes.map((nn) => {
          const existing = currentNodes.find((en) => en.id === nn.id);
          if (existing) {
            return {
              ...nn,
              position: existing.position,
              data: { ...nn.data, stats: existing.data.stats, onAction: handleNodeAction },
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
            return { ...ne, data: { ...ne.data, pending: true, onAction: handleEdgeAction } };
          }
          return { ...ne, data: { ...ne.data, onAction: handleEdgeAction } };
        });
      });
    },
    [handleNodeAction, handleEdgeAction, setNodes, setEdges]
  );

  const determineLinkColor = (latency: number) => {
    if (latency < 20) return "#22c55e"; // Green
    if (latency < 100) return "#eab308"; // Yellow
    return "#ef4444"; // Red
  };

  const processRef = useRef<((data: any) => void) | null>(null);

  // keep ref to latest processor to avoid stale closures in socket callbacks
  useEffect(() => {
    processRef.current = processTopologyData;
  }, [processTopologyData]);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge(
          { ...params, type: "custom", animated: true, data: { onAction: handleEdgeAction } },
          eds
        )
      );

      const source = params.source;
      const target = params.target;
      if (source && target) {
        fetch("http://localhost:5000/api/topology")
          .then((res) => res.json())
          .then((currentTopo) => {
            const newLink = { source, target, type: "manual" };
            const exists = currentTopo.links.find(
              (l: any) => l.source === source && l.target === target
            );
            if (!exists) {
              currentTopo.links.push(newLink);
              fetch("http://localhost:5000/api/topology", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(currentTopo),
              });
            }
          });
      }
    },
    [setEdges]
  );

  const onConnectStart = useCallback((event: MouseEvent, params: any) => {
    // params.nodeId, params.handleType, params.handleId available
    const nodeId = params?.nodeId || undefined;
    const handleType = params?.handleType as "source" | "target" | undefined;
    const handleId = params?.handleId || undefined;
    setConnectingInfo({ nodeId, handleType, handleId });
  }, []);

  const onConnectEnd = useCallback(() => {
    setConnectingInfo(null);
  }, []);

  // When connecting state changes, update node highlight flags
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (!connectingInfo) {
          return { ...n, data: { ...n.data, highlight: false, highlightHandle: undefined } };
        }
        // If user started from a 'source' handle, highlight 'target' handles on other nodes and vice-versa
        const targetHandle = connectingInfo.handleType === "source" ? "target" : "source";
        const shouldHighlight = n.id !== connectingInfo.nodeId;
        return {
          ...n,
          data: {
            ...n.data,
            highlight: shouldHighlight,
            highlightHandle: shouldHighlight ? targetHandle : undefined,
          },
        };
      })
    );
  }, [connectingInfo, setNodes]);

  return (
    <div className="w-full h-[calc(100vh-100px)] bg-slate-50 relative rounded-xl border overflow-hidden">
      {!isConnected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-red-500 z-50 animate-pulse" />
      )}

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        className="bg-slate-50 h-full"
        style={{ height: "100%" }}
      >
        <Background />
        <Controls />
      </ReactFlow>
      {/* Command console moved to global layout */}
    </div>
  );
};

export default TopologyGraph;
