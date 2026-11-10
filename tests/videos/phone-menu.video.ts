// The phone menu: the burger's circle grows into the menu at the top of home, the slash scrolls
// away with the hero while the circle stays, the menu again past the hero, then back to the top.
import { test, expect } from "@playwright/test";
import { glideTo, startRecording } from "./support/recorder.ts";

test("phone menu", async ({ page }, testInfo) => {
  await page.goto("fr/");
  const burger = page.locator(".nav-toggle");
  const header = page.locator(".site-header");
  const aboutTop = await page
    .locator("#about")
    .evaluate((element) => element.getBoundingClientRect().top + scrollY);

  const video = startRecording(page, testInfo, "phone-menu");
  await page.waitForTimeout(1500);

  await burger.tap();
  await page.waitForTimeout(1800);
  await burger.tap();
  await page.waitForTimeout(1200);

  await glideTo(page, aboutTop, 2200);
  await expect(header).toHaveAttribute("data-past-hero", "");
  await page.waitForTimeout(1500);

  await burger.tap();
  await page.waitForTimeout(1800);
  await burger.tap();
  await page.waitForTimeout(1200);

  await glideTo(page, 0, 2200);
  await page.waitForTimeout(1500);

  const file = await video.stop();
  console.log(`Video: ${file}`);
});
