type Entry = {
  id: string;
  hostname: string;
  command: string;
  status: string;
  data: any;
  timestamp: string;
  parsed?: any;
};

const subscribers: ((entries: Entry[]) => void)[] = [];
let entries: Entry[] = [];

function parseCommandResult(e: Entry): Entry {
  const parsed: any = {};
  // Parse ping outputs for latency
  try {
    const out = typeof e.data === "string" ? e.data : e.data?.output || "";
    if (out) {
      // look for time=12.3 ms or Average = 12ms
      const m = out.match(/time=([0-9]+\.?[0-9]*)/);
      if (m) parsed.latency = parseFloat(m[1]);
      else {
        const m2 = out.match(/Average =\s*([0-9]+)ms/);
        if (m2) parsed.latency = parseFloat(m2[1]);
      }
    }
  } catch (err) {
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
  entries = [e, ...entries].slice(0, 500);
  subscribers.forEach((s) => s(entries));
}

export function clear() {
  entries = [];
  subscribers.forEach((s) => s(entries));
}

export function getEntries() {
  return entries;
}
