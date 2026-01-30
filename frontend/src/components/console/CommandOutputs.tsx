import { Copy, Activity, Network } from "lucide-react";
import { toast } from "sonner";

interface CommandEntry {
  id: string;
  hostname: string;
  command: string;
  status: string;
  data: unknown;
  timestamp: string;
}

// Re-export the type
export type { CommandEntry };

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Output copied to clipboard");
}

/**
 * Render iPerf network test results
 */
export function IperfOutput({ entry }: { entry: CommandEntry }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = entry.data as any;
  const { bandwidth_mbps, bytes_sent } = data.summary || {};

  if (!bandwidth_mbps) {
    return <GenericOutput entry={entry} />;
  }

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
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Bandwidth
          </div>
          <div className="font-bold text-xl text-slate-900">
            {bandwidth}{" "}
            <span className="text-sm font-normal text-slate-500">Mbps</span>
          </div>
        </div>
        <div className="bg-white p-2 rounded border border-slate-100 shadow-sm">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold mb-1">
            Total Transfer
          </div>
          <div className="font-bold text-xl text-slate-900">
            {transferMB}{" "}
            <span className="text-sm font-normal text-slate-500">MB</span>
          </div>
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
}

/**
 * Render ping command results with parsed stats
 */
export function PingOutput({ entry }: { entry: CommandEntry }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = entry.data as any;
  const output =
    typeof entry.data === "string"
      ? entry.data
      : d?.output || JSON.stringify(entry.data);

  // Parse ping stats
  const packetLossMatch = output.match(/(\d+)% packet loss/);
  const rttMatch = output.match(
    /rtt min\/avg\/max\/mdev = ([\d.]+)\/([\d.]+)\/([\d.]+)\/([\d.]+) ms/,
  );

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm font-mono text-slate-800">
      <div className="flex items-center gap-2 font-bold text-blue-600 mb-2 pb-2 border-b border-slate-200">
        <Network className="w-4 h-4" />
        Ping Result
      </div>
      {packetLossMatch && (
        <div className="flex gap-4 mb-3">
          <div
            className={`text-xs px-2 py-1 rounded font-medium ${
              parseInt(packetLossMatch[1]) > 0
                ? "bg-red-100 text-red-700"
                : "bg-green-100 text-green-700"
            }`}
          >
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
}

/**
 * Generic JSON/text output renderer
 */
export function GenericOutput({ entry }: { entry: CommandEntry }) {
  const content =
    typeof entry.data === "string"
      ? entry.data
      : JSON.stringify(entry.data, null, 2);

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
}

/**
 * Route to appropriate output renderer based on command type
 */
export function CommandOutput({ entry }: { entry: CommandEntry }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = entry.data as any;

  if (entry.command === "run_iperf_client" && data?.summary) {
    return <IperfOutput entry={entry} />;
  }
  if (entry.command === "ping") {
    return <PingOutput entry={entry} />;
  }
  return <GenericOutput entry={entry} />;
}
