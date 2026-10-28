// After the run: merges the Chromium JS coverage written by fixtures.js and reports, per file in /js/,
// the share of lines executed by at least one test and the lines never executed.
// A line counts as executed when every non-blank character on it ran. Output: coverage/js-coverage.txt.
import fs from "node:fs";
import path from "node:path";

export default function report() {
  const dir = path.resolve("coverage/raw");
  if (!fs.existsSync(dir)) return;
  const files = {};
  for (const name of fs.readdirSync(dir)) {
    for (const entry of JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"))) {
      const file = new URL(entry.url).pathname.replace(/^\/ced\//, "");
      const source = entry.source || "";
      const f = (files[file] ||= { source, ran: new Uint8Array(source.length) });
      // V8 block coverage: outer ranges first, nested ranges refine them. Apply widest first.
      const ranges = entry.functions.flatMap((fn) => fn.ranges).sort((a, b) => (b.endOffset - b.startOffset) - (a.endOffset - a.startOffset));
      const count = new Int32Array(source.length).fill(-1);
      for (const r of ranges) count.fill(r.count, r.startOffset, Math.min(r.endOffset, source.length));
      count.forEach((c, i) => { if (c > 0) f.ran[i] = 1; });
    }
  }
  fs.rmSync(dir, { recursive: true, force: true });

  const lines = [];
  for (const [file, { source, ran }] of Object.entries(files).sort()) {
    let offset = 0, total = 0;
    const missed = [];
    source.split("\n").forEach((line, i) => {
      const chars = [...line].map((ch, j) => [ch, offset + j]).filter(([ch]) => ch.trim());
      offset += line.length + 1;
      if (!chars.length || /^\s*\/\//.test(line)) return;   // blank and comment lines do not count
      total++;
      if (chars.some(([, at]) => !ran[at])) missed.push(i + 1);
    });
    const pct = total ? (100 * (total - missed.length) / total).toFixed(1) : "100.0";
    lines.push(`${file}: ${pct}% of ${total} lines${missed.length ? `; not run: ${compact(missed)}` : ""}`);
  }
  const text = `JS coverage (Chromium)\n${lines.join("\n")}\n`;
  fs.mkdirSync("coverage", { recursive: true });
  fs.writeFileSync("coverage/js-coverage.txt", text);
  console.log(`\n${text}`);
}

/** [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
const compact = (nums) => nums.reduce((out, n) => {
  const last = out[out.length - 1];
  if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  return out;
}, []).map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`)).join(", ");
