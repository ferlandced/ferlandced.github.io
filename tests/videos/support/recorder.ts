// Records a page as an MP4: 2x JPEG screenshots taken back to back (about 30 per second), then
// joined by ffmpeg at their real timing. Playwright's own video is WebM at CSS pixels, too soft
// for a phone screen. Needs ffmpeg on the PATH (README, Setup).
import type { Page, TestInfo } from "@playwright/test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const FRAMES_PER_SECOND = 30;

interface Frame {
  file: string;
  time: number;
}

const requireFfmpeg = () => {
  const check = spawnSync("ffmpeg", ["-version"]);
  if (check.error || check.status !== 0) {
    throw new Error("ffmpeg is missing: brew install ffmpeg (README, Setup)");
  }
};

/** ffmpeg's concat list: each frame shown until the next one, the last one until the end. */
const concatList = (frames: Frame[], endTime: number) => {
  const lines: string[] = [];
  frames.forEach((frame, index) => {
    const nextTime = frames[index + 1]?.time ?? endTime;
    lines.push(`file '${frame.file}'`, `duration ${(nextTime - frame.time).toFixed(4)}`);
  });
  const lastFrame = frames.at(-1);
  if (lastFrame) {
    lines.push(`file '${lastFrame.file}'`);
  }
  return lines.join("\n");
};

const encode = (listFile: string, outputFile: string) => {
  const result = spawnSync(
    "ffmpeg",
    [
      ["-y", "-loglevel", "error"],
      ["-f", "concat", "-safe", "0", "-i", listFile],
      ["-vf", `fps=${FRAMES_PER_SECOND},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p`],
      ["-c:v", "libx264", "-crf", "18", "-movflags", "+faststart"],
      [outputFile],
    ].flat(),
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed: ${result.stderr}`);
  }
};

/**
 * Starts recording the page. `stop()` writes videos/<project>/<name>.mp4 and returns its path.
 * Frames go to the test's output folder (test-results/).
 */
export const startRecording = (page: Page, testInfo: TestInfo, name: string) => {
  requireFfmpeg();
  const framesFolder = testInfo.outputPath("frames");
  fs.mkdirSync(framesFolder, { recursive: true });

  const frames: Frame[] = [];
  const startTime = Date.now();
  let recording = true;

  const captureLoop = async () => {
    while (recording) {
      const time = (Date.now() - startTime) / 1000;
      const file = path.join(framesFolder, `frame-${String(frames.length).padStart(5, "0")}.jpg`);
      await page.screenshot({
        path: file,
        type: "jpeg",
        quality: 90,
        scale: "device",
        animations: "allow",
        caret: "initial",
      });
      frames.push({ file, time });
    }
  };
  const capturing = captureLoop();

  return {
    stop: async () => {
      recording = false;
      await capturing;
      const endTime = (Date.now() - startTime) / 1000;

      const listFile = path.join(framesFolder, "frames.txt");
      fs.writeFileSync(listFile, concatList(frames, endTime));
      const outputFile = path.resolve("videos", testInfo.project.name, `${name}.mp4`);
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      encode(listFile, outputFile);
      return outputFile;
    },
  };
};

/** Scrolls the page to `top` over `duration` ms, easing in and out, like a finger swipe. */
export const glideTo = (page: Page, top: number, duration: number) =>
  page.evaluate(
    ([top, duration]) =>
      new Promise<void>((resolve) => {
        const start = scrollY;
        const startTime = performance.now();
        const step = (now: number) => {
          const progress = Math.min(1, (now - startTime) / duration);
          const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
          window.scrollTo({ top: start + (top - start) * eased, behavior: "instant" });
          if (progress < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };
        requestAnimationFrame(step);
      }),
    [top, duration] as const,
  );
