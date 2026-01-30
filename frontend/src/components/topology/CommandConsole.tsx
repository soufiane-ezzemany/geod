import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Resizable } from "re-resizable";
import { Badge } from "@/components/ui/badge";
import { ArrowDown, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandOutput,
  type CommandEntry,
} from "@/components/console/CommandOutputs";

// Re-export for consumers
export type { CommandEntry };

/**
 * Custom hook for managing console scroll behavior
 */
function useConsoleScroll(entriesLength: number, isOpen: boolean) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(entriesLength);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  const checkAtBottom = useCallback(() => {
    if (!scrollRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    return Math.abs(scrollHeight - clientHeight - scrollTop) < 50;
  }, []);

  const handleScroll = useCallback(() => {
    const atBottom = checkAtBottom();
    setIsAtBottom(atBottom);
    if (atBottom) setShowScrollButton(false);
  }, [checkAtBottom]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setIsAtBottom(true);
      setShowScrollButton(false);
    }
  }, []);

  // Handle new entries
  useEffect(() => {
    if (entriesLength > prevCountRef.current && isOpen) {
      if (isAtBottom) {
        requestAnimationFrame(() => scrollToBottom());
      } else {
        requestAnimationFrame(() => setShowScrollButton(true));
      }
    }
    prevCountRef.current = entriesLength;
  }, [entriesLength, isOpen, isAtBottom, scrollToBottom]);

  return { scrollRef, handleScroll, scrollToBottom, showScrollButton };
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
  const [lastReadCount, setLastReadCount] = useState(entries.length);

  const { scrollRef, handleScroll, scrollToBottom, showScrollButton } =
    useConsoleScroll(entries.length, open);

  // Derived state
  const hasUnread = !open && entries.length > lastReadCount;
  const hosts = useMemo(
    () => Array.from(new Set(entries.map((e) => e.hostname))),
    [entries],
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterHost && e.hostname !== filterHost) return false;
      if (filterCmd && !e.command.includes(filterCmd)) return false;
      return true;
    });
  }, [entries, filterHost, filterCmd]);

  // Sync lastReadCount when toggling
  useEffect(() => {
    requestAnimationFrame(() => {
      setLastReadCount(entries.length);
      if (open) {
        scrollToBottom();
      }
    });
  }, [open, entries.length, scrollToBottom]);

  if (!open) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] backdrop-blur-sm">
        <div className="px-4 py-2 flex items-center justify-between">
          <div className="font-semibold text-sm flex items-center gap-2 text-slate-700">
            <Terminal className="w-4 h-4" />
            Terminal
            {hasUnread && (
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
            )}
          </div>
          <button
            className="text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5 group"
            onClick={() => setOpen(true)}
            aria-label="Open console"
          >
            Open Console
            {hasUnread && (
              <Badge className="h-4 px-1 text-[9px] min-w-[1.25rem] bg-blue-600 group-hover:bg-blue-700">
                New
              </Badge>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <Resizable
        enable={{ top: true }}
        defaultSize={{ width: "100%", height: 320 }}
        size={{ width: "100%", height }}
        minHeight={120}
        maxHeight={Math.floor(
          typeof window !== "undefined" ? window.innerHeight * 0.9 : 800,
        )}
        onResizeStop={(_e, _direction, _ref, d) => {
          setHeight((h) => Math.max(120, h + d.height));
        }}
        className="bg-white/95 border-t shadow-2xl flex flex-col backdrop-blur-sm"
        style={{ maxHeight: "90vh" }}
      >
        <div className="w-full h-full flex flex-col relative">
          {/* Header */}
          <div className="px-4 py-2 flex items-start justify-between flex-shrink-0 bg-white border-b">
            <div className="font-semibold flex items-center gap-2 text-slate-800">
              <Terminal className="w-4 h-4" />
              Console
              <Badge
                variant="secondary"
                className="text-[10px] h-5 px-1.5 min-w-[1.5rem] justify-center"
              >
                {entries.length}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="text-xs font-medium text-slate-500 hover:text-red-600 transition-colors px-2 py-1 rounded hover:bg-red-50"
                onClick={onClear}
              >
                Clear
              </button>
              <div className="w-px h-4 bg-slate-200 mx-1" />
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
                  <li
                    key={e.id}
                    className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden"
                  >
                    <div className="flex justify-between items-center px-3 py-2 bg-slate-50 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] bg-white text-slate-600 border-slate-300"
                        >
                          {e.hostname}
                        </Badge>
                        <span className="text-xs font-semibold text-slate-700 font-mono">
                          $ {e.command}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 tabular-nums font-medium">
                        {new Date(e.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="p-3">
                      <CommandOutput entry={e} />
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
  );
}
