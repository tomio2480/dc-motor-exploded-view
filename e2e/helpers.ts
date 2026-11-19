import { expect, type Page } from "@playwright/test";

/** サイトを開き，3D の表示の準備が終わるまで待つ． */
export async function openSite(page: Page): Promise<void> {
  // アニメーションを省き，表示の完了を待たずに検証できるようにする．
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator("#stage")).toHaveAttribute("data-ready", "true");
}

/** 描画と配置の反映を待つため，2 フレーム待つ． */
export async function waitForFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            resolve();
          });
        });
      }),
  );
}
