export type Entry = {
  id: string;
  hostname: string;
  command: string;
  status: string;
  data: unknown;
  timestamp: string;
  parsed?: Record<string, unknown>;
};

const subscribers: ((entries: Entry[]) => void)[] = [];
let entries: Entry[] = [];

function parseCommandResult(e: Entry): Entry {
  const parsed: Record<string, unknown> = {};
  // Parse ping outputs for latency
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = e.data as any;
    const out = typeof e.data === "string" ? e.data : d?.output || "";
    if (out) {
      // look for time=12.3 ms or Average = 12ms
      const m = out.match(/time=([0-9]+\.?[0-9]*)/);
      if (m) parsed.latency = parseFloat(m[1]);
      else {
        const m2 = out.match(/Average =\s*([0-9]+)ms/);
        if (m2) parsed.latency = parseFloat(m2[1]);
      }
    }
  } catch {
    // ignore
  }
  return { ...e, parsed };
}

export function subscribe(fn: (entries: Entry[]) => void) {
  subscribers.push(fn);
  fn(entries);
  return () => {
    const idx = subscribers.indexOf(fn);
    if (idx >= 0) subscribers.splice(idx, 1);
  };
}

export function addEntry(raw: Entry) {
  const e = parseCommandResult(raw);
  // Append to end, keep last 500
  entries = [...entries, e];
  if (entries.length > 500) {
    entries = entries.slice(entries.length - 500);
  }
  subscribers.forEach((s) => s(entries));
}

export function clear() {
  entries = [];
  subscribers.forEach((s) => s(entries));
}

export function getEntries() {
  return entries;
}
