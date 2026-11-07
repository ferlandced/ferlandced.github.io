// After the run: merges the Chromium JS coverage written by fixtures.ts and reports, per file in /js/,
// the share of lines executed by at least one test and the lines never executed.
// A line counts as executed when every non-blank character on it ran. Output: coverage/js-coverage.txt.
// The served .js keeps the lines of its .ts source (see eleventy.config.ts), so lines are reported per .ts file.
import fs from "node:fs";
import path from "node:path";

interface CoverageRange {
  count: number;
  startOffset: number;
  endOffset: number;
}

/** One script's V8 coverage, as Playwright's stopJSCoverage() returns it. */
interface CoverageEntry {
  url: string;
  source?: string;
  functions: { ranges: CoverageRange[] }[];
}

interface FileCoverage {
  source: string;
  /** 1 for each character of the source that ran in at least one test. */
  ran: Uint8Array;
}

export default function report() {
  const directory = path.resolve("coverage/raw");
  if (!fs.existsSync(directory)) {
    return;
  }
  const files = new Map<string, FileCoverage>();
  for (const name of fs.readdirSync(directory)) {
    const entries = JSON.parse(
      fs.readFileSync(path.join(directory, name), "utf8"),
    ) as CoverageEntry[];
    for (const entry of entries) {
      const file = new URL(entry.url).pathname.replace(/^\/ced\//, "").replace(/\.js$/, ".ts");
      const source = entry.source ?? "";
      const fileCoverage = files.get(file) ?? { source, ran: new Uint8Array(source.length) };
      files.set(file, fileCoverage);
      // V8 block coverage: outer ranges first, nested ranges refine them. Apply widest first.
      const ranges = entry.functions
        .flatMap((coveredFunction) => coveredFunction.ranges)
        .sort(
          (first, second) =>
            second.endOffset - second.startOffset - (first.endOffset - first.startOffset),
        );
      const count = new Int32Array(source.length).fill(-1);
      for (const range of ranges) {
        count.fill(range.count, range.startOffset, Math.min(range.endOffset, source.length));
      }
      count.forEach((hits, index) => {
        if (hits > 0) {
          fileCoverage.ran[index] = 1;
        }
      });
    }
  }
  fs.rmSync(directory, { recursive: true, force: true });

  const lines: string[] = [];
  const byName = [...files].sort(([first], [second]) => first.localeCompare(second));
  for (const [file, { source, ran }] of byName) {
    let offset = 0;
    let total = 0;
    const missed: number[] = [];
    source.split("\n").forEach((line, index) => {
      const lineStart = offset;
      // UTF-16 code units, like V8's offsets (spreading the string would split by code point)
      const characterOffsets = line
        .split("")
        .map((character, position) => ({ character, at: lineStart + position }))
        .filter(({ character }) => character.trim());
      offset += line.length + 1;
      // Blank and comment lines do not count
      if (!characterOffsets.length || /^\s*\/\//.test(line)) {
        return;
      }
      total++;
      if (characterOffsets.some(({ at }) => !ran[at])) {
        missed.push(index + 1);
      }
    });
    const percent = total ? ((100 * (total - missed.length)) / total).toFixed(1) : "100.0";
    lines.push(
      `${file}: ${percent}% of ${total} lines${missed.length ? `; not run: ${compact(missed)}` : ""}`,
    );
  }
  const text = `JS coverage (Chromium)\n${lines.join("\n")}\n`;
  fs.mkdirSync("coverage", { recursive: true });
  fs.writeFileSync("coverage/js-coverage.txt", text);
  console.log(`\n${text}`);
}

/** [1,2,3,7,9,10] -> "1-3, 7, 9-10" */
const compact = (numbers: number[]) =>
  numbers
    .reduce<[number, number][]>((ranges, number) => {
      const last = ranges.at(-1);
      if (last && number === last[1] + 1) {
        last[1] = number;
      } else {
        ranges.push([number, number]);
      }
      return ranges;
    }, [])
    .map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`))
    .join(", ");
