import { useCallback } from "react";
import { useSocket } from "@/context/socket-context";
import { toast } from "sonner";
import { topologyLogger } from "@/lib/logger";
import { UI } from "@/lib/constants";
import type { CommandParams, IperfClientParams } from "@/types/network";

/**
 * Hook for handling topology node and edge commands
 */
export function useTopologyCommands() {
  const { socket } = useSocket();

  const handleNodeAction = useCallback(
    (action: string, nodeId: string, params?: CommandParams) => {
      topologyLogger.debug(`Node Action: ${action} on ${nodeId}`, params);

      if (action === "details") {
        toast.info(`Agent: ${nodeId}`);
        return;
      }

      if (!socket || !socket.connected) {
        toast.error("WebSocket not connected — unable to send command.");
        topologyLogger.warn("Attempted command without socket connected:", action, nodeId);
        return;
      }

      switch (action) {
        case "ping":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "ping",
            params: params || { target: "8.8.8.8", count: UI.DEFAULT_PING_COUNT },
          });
          toast.info(`Ping lancé depuis ${nodeId}...`);
          break;

        case "traceroute":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "traceroute",
            params: params || { target: "8.8.8.8" },
          });
          toast.info(`Traceroute lancé depuis ${nodeId}...`);
          break;

        case "list_connections":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "list_connections",
            params: {},
          });
          toast.info(`Liste des connexions de ${nodeId}...`);
          break;

        case "get_network_stats":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "get_network_stats",
            params: {},
          });
          toast.info(`Stats réseau de ${nodeId}...`);
          break;

        case "get_system_stats":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "get_system_stats",
            params: {},
          });
          toast.info(`Stats système de ${nodeId}...`);
          break;

        case "start_iperf_server":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "start_iperf_server",
            params: params || { port: UI.DEFAULT_IPERF_PORT },
          });
          toast.success(`Serveur Iperf démarré sur ${nodeId}`);
          break;

        case "stop_iperf":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "stop_iperf",
            params: {},
          });
          toast.success(`Serveur Iperf arrêté sur ${nodeId}`);
          break;

        case "chaos_control":
          socket.emit("trigger_command", {
            target_hostname: nodeId,
            command: "chaos_control",
            params: params,
          });
          toast.success(`Chaos rules applied to ${nodeId}`);
          break;
      }
    },
    [socket]
  );

  const handleEdgeAction = useCallback(
    (
      action: string,
      _edgeId: string,
      source: string,
      target: string,
      params?: CommandParams
    ) => {
      topologyLogger.debug(`Edge Action: ${action} on ${source}->${target}`, params);

      if (action === "iperf") {
        if (!socket || !socket.connected) {
          toast.error("WebSocket not connected — unable to send command.");
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
              target: target,
              duration: iperfParams?.duration || UI.DEFAULT_IPERF_DURATION,
            },
          });
          toast.success(`Started Iperf Client on ${source} -> ${target}`);
        }, 1000);
      }
    },
    [socket]
  );

  return { handleNodeAction, handleEdgeAction };
}
