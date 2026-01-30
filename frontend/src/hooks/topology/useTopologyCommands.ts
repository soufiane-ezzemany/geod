import { useCallback } from "react";
import { useSocket } from "@/context/socket-context";
import { toast } from "sonner";
import type {
  BandwidthParams,
  CommandParams,
  IperfClientParams,
} from "@/types/network";
import type { Socket } from "socket.io-client";

/**
 * Emits a command to the backend via socket
 */
function emitCommand(
  socket: Socket,
  hostname: string,
  command: string,
  params: object = {}
) {
  socket.emit("trigger_command", {
    target_hostname: hostname,
    command,
    params,
  });
}

/**
 * Hook for handling topology node and edge commands
 */
export function useTopologyCommands() {
  const { socket } = useSocket();

  const handleNodeAction = useCallback(
    (action: string, nodeId: string, params?: CommandParams) => {
      console.log(`Node Action: ${action} on ${nodeId}`, params);

      if (action === "details") {
        toast.info(`Agent: ${nodeId}`);
        return;
      }

      if (!socket || !socket.connected) {
        toast.error("WebSocket not connected — unable to send command.");
        console.warn("Attempted command without socket connected:", action, nodeId, params);
        return;
      }

      switch (action) {
        case "ping":
          emitCommand(socket, nodeId, "ping", params || { target: "8.8.8.8", count: 4 });
          toast.info(`Ping lancé depuis ${nodeId}...`);
          break;

        case "traceroute":
          emitCommand(socket, nodeId, "traceroute", params || { target: "8.8.8.8" });
          toast.info(`Traceroute lancé depuis ${nodeId}...`);
          break;

        case "list_connections":
          emitCommand(socket, nodeId, "list_connections", {});
          toast.info(`Liste des connexions de ${nodeId}...`);
          break;

        case "get_network_stats":
          emitCommand(socket, nodeId, "get_network_stats", {});
          toast.info(`Stats réseau de ${nodeId}...`);
          break;

        case "get_system_stats":
          emitCommand(socket, nodeId, "get_system_stats", {});
          toast.info(`Stats système de ${nodeId}...`);
          break;

        case "start_iperf_server":
          emitCommand(socket, nodeId, "start_iperf_server", params || { port: 5201 });
          toast.success(`Serveur Iperf démarré sur ${nodeId}`);
          break;

        case "stop_iperf":
          emitCommand(socket, nodeId, "stop_iperf", {});
          toast.success(`Serveur Iperf arrêté sur ${nodeId}`);
          break;

        case "bandwidth": {
          const bwParams = params as BandwidthParams;
          emitCommand(socket, nodeId, "bandwidth_limit", { limit: bwParams?.limit });
          toast.success(`Bandwidth limit: ${bwParams?.limit} (Node: ${nodeId})`);
          break;
        }

        case "latency": {
          const latParams = params as BandwidthParams;
          const delayVal = (params as Record<string, unknown>)?.delay || latParams?.latency;
          emitCommand(socket, nodeId, "bandwidth_limit", { latency: delayVal });
          toast.success(`Latency: ${delayVal} (Node: ${nodeId})`);
          break;
        }

        case "loss": {
          const lossParams = params as BandwidthParams;
          emitCommand(socket, nodeId, "bandwidth_limit", { loss: lossParams?.loss });
          toast.success(`Packet Loss: ${lossParams?.loss} (Node: ${nodeId})`);
          break;
        }

        case "reset_traffic":
          emitCommand(socket, nodeId, "bandwidth_limit", { limit: null, latency: null, loss: null });
          toast.success(`Traffic control reset (Node: ${nodeId})`);
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
      console.log(`Edge Action: ${action} on ${source}->${target}`, params);

      if (action === "iperf") {
        if (!socket) {
          toast.error("WebSocket not connected — impossible d'envoyer la commande.");
          return;
        }

        const iperfParams = params as IperfClientParams;

        // 1. Start Server on Target
        emitCommand(socket, target, "start_iperf_server", {});
        toast.info(`Starting Iperf Server on ${target}...`);

        // 2. Start Client on Source (after short delay)
        setTimeout(() => {
          emitCommand(socket, source, "run_iperf_client", {
            target: target,
            duration: iperfParams?.duration || 10,
          });
          toast.success(`Started Iperf Client on ${source} -> ${target}`);
        }, 1000);
      }
    },
    [socket]
  );

  return { handleNodeAction, handleEdgeAction };
}
