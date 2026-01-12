import { addEntry, clear as clearStore, getEntries, subscribe, type Entry } from "@/lib/commandStore";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useCommandConsole() {
  const [entries, setEntries] = useState<Entry[]>(getEntries());
  useEffect(() => {
    const socket: Socket = io("http://localhost:5000");
    socket.on("command_result_update", (data) => {
      const entry = {
        id: data.result?.request_id || `r_${Date.now()}`,
        hostname: data.hostname || data.result?.hostname || "unknown",
        command: data.result?.command || data.result?.action || "cmd",
        status: data.result?.status || "ok",
        data: data.result?.data || data.result || data,
        timestamp: data.result?.timestamp || new Date().toISOString(),
      };
      addEntry(entry);
    });

    const unsub = subscribe((es) => setEntries(es));

    return () => {
      unsub();
      socket.disconnect();
    };
  }, []);

  return { entries, clear: () => clearStore() };
}
