import {
  addEntry,
  clear as clearStore,
  getEntries,
  subscribe,
  type Entry,
} from "@/lib/commandStore";
import { useSocket } from "@/context/socket-context";
import { useEffect, useState } from "react";

export function useCommandConsole() {
  const [entries, setEntries] = useState<Entry[]>(getEntries());
  const { socket } = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleCommandResult = (data: {
      hostname?: string;
      result?: {
        request_id?: string;
        hostname?: string;
        command?: string;
        action?: string;
        status?: string;
        data?: unknown;
        timestamp?: string;
      };
    }) => {
      const entry = {
        id: data.result?.request_id || `r_${Date.now()}`,
        hostname: data.hostname || data.result?.hostname || "unknown",
        command: data.result?.command || data.result?.action || "cmd",
        status: data.result?.status || "ok",
        data: data.result?.data || data.result || data,
        timestamp: data.result?.timestamp || new Date().toISOString(),
      };
      addEntry(entry);
    };

    socket.on("command_result_update", handleCommandResult);

    const unsub = subscribe((es) => setEntries(es));

    return () => {
      unsub();
      socket.off("command_result_update", handleCommandResult);
    };
  }, [socket]);

  return { entries, clear: () => clearStore() };
}
