import { useMemo, useState } from "react";
// Note: requires installing `re-resizable` in the frontend
import { Resizable } from "re-resizable";

interface CommandEntry {
  id: string;
  hostname: string;
  command: string;
  status: string;
  data: any;
  timestamp: string;
  parsed?: any;
}

export default function CommandConsole({
  entries,
  onClear,
}: {
  entries: CommandEntry[];
  onClear: () => void;
}) {
  const [filterHost, setFilterHost] = useState("");
  const [filterCmd, setFilterCmd] = useState("");
  const [open, setOpen] = useState(true);
  const [height, setHeight] = useState<number>(320);

  const hosts = useMemo(() => Array.from(new Set(entries.map((e) => e.hostname))), [entries]);

  const filtered = entries.filter((e) => {
    if (filterHost && e.hostname !== filterHost) return false;
    if (filterCmd && !e.command.includes(filterCmd)) return false;
    return true;
  });

  return (
    <>
      {open ? (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <Resizable
            enable={{ top: true }}
            defaultSize={{ width: "100%", height: 320 }}
            size={{ width: "100%", height }}
            minHeight={120}
            maxHeight={Math.floor(typeof window !== "undefined" ? window.innerHeight * 0.9 : 800)}
            onResizeStop={(e, direction, ref, d) => {
              setHeight((h) => Math.max(120, h + d.height));
            }}
            className="bg-white/95 border-t shadow-lg"
            style={{ maxHeight: "90vh" }}
          >
            <div className="w-full" aria-hidden>
              <div className="px-4 py-2 flex items-start justify-between">
                <div className="font-semibold">Console</div>
                <div className="flex items-center gap-2">
                  <button className="text-sm text-muted-foreground" onClick={onClear}>
                    Clear
                  </button>
                  <button
                    className="text-sm text-muted-foreground"
                    onClick={() => setOpen(false)}
                    aria-label="Close console"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="px-4 pb-4">
                <div className="flex gap-2 mb-2">
                  <select
                    value={filterHost}
                    onChange={(e) => setFilterHost(e.target.value)}
                    className="text-xs p-1 border rounded"
                  >
                    <option value="">Tous les hôtes</option>
                    {hosts.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <input
                    placeholder="Filtrer la commande"
                    value={filterCmd}
                    onChange={(e) => setFilterCmd(e.target.value)}
                    className="text-xs p-1 border rounded flex-1"
                  />
                </div>

                <div className="overflow-y-auto" style={{ maxHeight: height - 100 }}>
                  {filtered.length === 0 && (
                    <div className="text-muted-foreground">Aucune sortie de commande</div>
                  )}
                  <ul className="space-y-2">
                    {filtered.map((e) => (
                      <li key={e.id} className="border rounded p-2 bg-slate-50">
                        <div className="flex justify-between items-center">
                          <div className="font-mono text-[12px]">
                            {e.hostname} • {e.command}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] break-words">
                          {e.parsed?.latency != null && (
                            <div className="text-sm font-semibold">
                              Latency: {e.parsed.latency} ms
                            </div>
                          )}
                          <pre className="whitespace-pre-wrap text-[11px]">
                            {typeof e.data === "string" ? e.data : JSON.stringify(e.data, null, 2)}
                          </pre>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </Resizable>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 border-t shadow-lg">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="font-semibold">Console</div>
            <div className="flex items-center gap-2">
              <button
                className="bg-primary text-primary-foreground px-3 py-1 rounded shadow"
                onClick={() => setOpen(true)}
                aria-label="Open console"
              >
                Open
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
