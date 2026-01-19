import { useMemo, useState, useEffect, useRef } from "react";
// Note: requires installing `re-resizable` in the frontend
import { Resizable } from "re-resizable";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Copy, Terminal, Activity, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ParsedCommandData {
  latency?: number;
  [key: string]: unknown;
}

interface CommandEntry {
  id: string;
  hostname: string;
  command: string;
  status: string;
  data: unknown;
  timestamp: string;
  parsed?: ParsedCommandData;
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
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState<number>(320);
  
  // UX State
  const [lastReadCount, setLastReadCount] = useState(entries.length);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(entries.length);

  // Derived state for unread badge
  const hasUnread = !open && entries.length > lastReadCount;

  const hosts = useMemo(() => Array.from(new Set(entries.map((e) => e.hostname))), [entries]);

  const filtered = entries.filter((e) => {
    if (filterHost && e.hostname !== filterHost) return false;
    if (filterCmd && !e.command.includes(filterCmd)) return false;
    return true;
  });

  // Check if user is at bottom
  const checkAtBottom = () => {
    if (!scrollRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
  };

  const handleScroll = () => {
      const atBottom = checkAtBottom();
      setIsAtBottom(atBottom);
      if (atBottom) setShowScrollButton(false);
  };

  const scrollToBottom = () => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          setIsAtBottom(true);
          setShowScrollButton(false);
      }
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      toast.success("Output copied to clipboard");
  };

  // Handle new entries (Auto-scroll & Scroll Button)
  useEffect(() => {
    if (entries.length > prevCountRef.current) {
      if (open) {
        if (isAtBottom) {
            requestAnimationFrame(() => scrollToBottom());
        } else {
            setShowScrollButton(true);
        }
      }
    }
    prevCountRef.current = entries.length;
  }, [entries.length, open, isAtBottom]);

  // Sync lastReadCount when opening/closing
  useEffect(() => {
    if (open) {
        setLastReadCount(entries.length);
        requestAnimationFrame(() => scrollToBottom());
    } else {
        setLastReadCount(entries.length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]); 

  // --- Renderers ---

  const renderIperf = (entry: CommandEntry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = entry.data as any;
      const { bandwidth_mbps, bytes_sent } = data.summary || {};
      if (!bandwidth_mbps) return renderGeneric(entry);

      const transferMB = (bytes_sent / 1_000_000).toFixed(2);
      const bandwidth = bandwidth_mbps?.toFixed(2);
      
      return (
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm font-mono text-slate-800">
              <div className="flex items-center gap-2 font-bold text-green-600 mb-3 border-b border-slate-200 pb-2">
                  <Activity className="w-4 h-4" />
                  Network Performance Test (Iperf3)
              </div>
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="bg-white p-2 rounded border border-slate-100 shadow-sm">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Bandwidth</div>
                    <div className="font-bold text-xl text-slate-900">{bandwidth} <span className="text-sm font-normal text-slate-500">Mbps</span></div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-100 shadow-sm">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">Total Transfer</div>
                    <div className="font-bold text-xl text-slate-900">{transferMB} <span className="text-sm font-normal text-slate-500">MB</span></div>
                </div>
              </div>
              <details className="mt-2 group">
                  <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1 select-none">
                      <span>View Raw JSON</span>
                  </summary>
                  <div className="relative mt-2">
                    <pre className="text-[10px] overflow-auto max-h-40 bg-slate-900 text-slate-50 p-3 rounded shadow-inner">
                        {JSON.stringify(entry.data, null, 2)}
                    </pre>
                    <button 
                        onClick={() => copyToClipboard(JSON.stringify(entry.data, null, 2))}
                        className="absolute top-2 right-2 p-1 bg-slate-700 text-slate-300 rounded hover:bg-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                        <Copy className="w-3 h-3" />
                    </button>
                  </div>
              </details>
          </div>
      );
  };

  const renderPing = (entry: CommandEntry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const d = entry.data as any;
      const output = typeof entry.data === 'string' ? entry.data : d?.output || JSON.stringify(entry.data);
      // Basic parsing for ping stats
      const packetLossMatch = output.match(/(\d+)% packet loss/);
      const rttMatch = output.match(/rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/);
      
      return (
        <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm font-mono text-slate-800">
             <div className="flex items-center gap-2 font-bold text-blue-600 mb-2 pb-2 border-b border-slate-200">
                  <Network className="w-4 h-4" />
                  Ping Result
              </div>
              {packetLossMatch && (
                  <div className="flex gap-4 mb-3">
                      <div className={`text-xs px-2 py-1 rounded font-medium ${parseInt(packetLossMatch[1]) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          Packet Loss: {packetLossMatch[1]}%
                      </div>
                      {rttMatch && (
                          <div className="text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 font-medium">
                              Avg Latency: {rttMatch[2]} ms
                          </div>
                      )}
                  </div>
              )}
              <div className="relative group">
                <pre className="text-[11px] leading-relaxed whitespace-pre-wrap text-slate-600 overflow-x-auto">
                    {output}
                </pre>
                <button 
                    onClick={() => copyToClipboard(output)}
                    className="absolute top-0 right-0 p-1.5 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Copy className="w-3 h-3" />
                </button>
              </div>
        </div>
      );
  };

  const renderGeneric = (entry: CommandEntry) => {
      const content = typeof entry.data === "string" ? entry.data : JSON.stringify(entry.data, null, 2);
      return (
        <div className="bg-slate-900 rounded-md p-3 relative group">
            <pre className="text-[11px] font-mono text-green-400 whitespace-pre-wrap overflow-x-auto max-h-60 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {content}
            </pre>
            <button 
                onClick={() => copyToClipboard(content)}
                className="absolute top-2 right-2 p-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <Copy className="w-3 h-3" />
            </button>
        </div>
      );
  };

  const renderData = (entry: CommandEntry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = entry.data as any;
      if (entry.command === 'run_iperf_client' && data?.summary) {
          return renderIperf(entry);
      }
      if (entry.command === 'ping') {
          return renderPing(entry);
      }
      return renderGeneric(entry);
  };

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
            onResizeStop={(_e, _direction, _ref, d) => {
              setHeight((h) => Math.max(120, h + d.height));
            }}
            className="bg-white/95 border-t shadow-2xl flex flex-col backdrop-blur-sm"
            style={{ maxHeight: "90vh" }}
          >
            <div className="w-full h-full flex flex-col relative" aria-hidden>
              {/* Header */}
              <div className="px-4 py-2 flex items-start justify-between flex-shrink-0 bg-white border-b">
                <div className="font-semibold flex items-center gap-2 text-slate-800">
                    <Terminal className="w-4 h-4" />
                    Console
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 min-w-[1.5rem] justify-center">{entries.length}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <button className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50" onClick={onClear}>
                    Clear
                  </button>
                  <div className="w-px h-4 bg-slate-200 mx-1"></div>
                  <button
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors px-2 py-1 rounded hover:bg-slate-100"
                    onClick={() => setOpen(false)}
                    aria-label="Close console"
                  >
                    Close
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              <div className="px-4 py-2 flex gap-2 border-b bg-slate-50/80 flex-shrink-0">
                <select
                    value={filterHost}
                    onChange={(e) => setFilterHost(e.target.value)}
                    className="text-xs p-1.5 border rounded bg-white shadow-sm focus:ring-1 focus:ring-primary outline-none min-w-[120px]"
                >
                    <option value="">All Hosts</option>
                    {hosts.map((h) => (
                    <option key={h} value={h}>
                        {h}
                    </option>
                    ))}
                </select>
                <input
                    placeholder="Filter output..."
                    value={filterCmd}
                    onChange={(e) => setFilterCmd(e.target.value)}
                    className="text-xs p-1.5 border rounded flex-1 bg-white shadow-sm focus:ring-1 focus:ring-primary outline-none font-mono placeholder:font-sans"
                />
              </div>

              {/* Content */}
              <div className="flex-1 overflow-hidden relative bg-slate-100/50">
                <div 
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="h-full overflow-y-auto p-4 space-y-4 scroll-smooth"
                >
                  {filtered.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
                        <Terminal className="w-12 h-12 mb-2 stroke-1" />
                        <div className="text-sm">No command output available</div>
                    </div>
                  )}
                  <ul className="space-y-4">
                    {filtered.map((e) => (
                      <li key={e.id} className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
                        <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-b border-slate-100">
                          <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono text-[10px] bg-white text-slate-600 border-slate-300">{e.hostname}</Badge>
                              <span className="text-xs font-semibold text-slate-700 font-mono">
                                $ {e.command}
                              </span>
                          </div>
                          <div className="text-[10px] text-slate-400 tabular-nums font-medium">
                            {new Date(e.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                        <div className="p-3">
                            {renderData(e)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* New Output Button */}
                {showScrollButton && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 animate-in slide-in-from-bottom-2 fade-in duration-200">
                        <Button 
                            size="sm" 
                            className="shadow-xl rounded-full h-9 pl-3 pr-4 bg-blue-600 text-white hover:bg-blue-700 border border-blue-500"
                            onClick={scrollToBottom}
                        >
                            <ArrowDown className="w-4 h-4 mr-2 animate-bounce" />
                            New Output
                        </Button>
                    </div>
                )}
              </div>
            </div>
          </Resizable>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] backdrop-blur-sm">
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="font-semibold text-sm flex items-center gap-2 text-slate-700">
                <Terminal className="w-4 h-4" />
                Terminal
                {hasUnread && (
                    <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 group"
                onClick={() => setOpen(true)}
                aria-label="Open console"
              >
                Open Console
                {hasUnread && <Badge className="h-4 px-1 text-[9px] min-w-[1.25rem] bg-blue-600 group-hover:bg-blue-700">New</Badge>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
