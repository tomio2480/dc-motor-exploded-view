import { expect, test } from "@playwright/test";

const READY_TIMEOUT_MS = 20_000;

test.describe("描画の診断", () => {
  test("通常は描画の速さを表示しない", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("./");
    await expect(page.locator("#stage")).toHaveAttribute("data-ready", "true");
    await expect(page.locator("#frame-stats")).toBeHidden();
  });

  test("fps=on を付けると，描画の速さと設定を表示する", async ({ page }) => {
    // 連続した描画が要るため，展開のアニメーションを動かす．
    await page.goto("./?fps=on");
    const stats = page.locator("#frame-stats");
    await expect(stats).toBeVisible({ timeout: READY_TIMEOUT_MS });
    await expect(stats).toContainText("fps", { timeout: READY_TIMEOUT_MS });
    await expect(stats).toContainText("AA あり");
    await expect(stats).toContainText("ぼかしあり");
    await expect(stats).toContainText(/\d+×\d+ px/);
  });

  test("aa=off と blur=off と dpr を付けても表示でき，設定が反映される", async ({
    page,
  }) => {
    await page.goto("./?fps=on&aa=off&blur=off&dpr=1");
    const stats = page.locator("#frame-stats");
    await expect(stats).toContainText("AA なし", { timeout: READY_TIMEOUT_MS });
    await expect(stats).toContainText("ぼかしなし");
    await expect(page.locator("html")).toHaveAttribute("data-blur", "off");
    const hasAntialias = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      return canvas?.getContext("webgl2")?.getContextAttributes()?.antialias;
    });
    expect(hasAntialias).toBe(false);
  });
});
