import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const PART_COUNT = 10;
const ANIMATION_TIMEOUT_MS = 20_000;

async function openSite(page: Page): Promise<void> {
  // アニメーションを省き，表示の完了を待たずに検証できるようにする．
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("./");
  await expect(page.locator("#stage")).toHaveAttribute("data-ready", "true");
}

test.describe("3D 展開図", () => {
  test.beforeEach(async ({ page }) => {
    await openSite(page);
  });

  test("見出しと 3D の描画領域を表示する", async ({ page }) => {
    await expect(page).toHaveTitle(/DC モーター/);
    await expect(
      page.getByRole("heading", { level: 1, name: /DC モーター/ }),
    ).toBeVisible();
    await expect(page.locator("canvas#scene")).toBeVisible();
  });

  test("展開した状態で始まり，部品の番号を表示する", async ({ page }) => {
    await expect(page.getByLabel("展開の度合い")).toHaveValue("100");
    const labels = page.locator("#labels button");
    await expect(labels).toHaveCount(PART_COUNT);
    await expect(labels.first()).toBeVisible();
  });

  test("部品の番号を選ぶと解説を表示する", async ({ page }) => {
    await page.getByRole("button", { name: "7 整流子" }).click();
    const info = page.locator("#part-info");
    await expect(info).toBeVisible();
    await expect(info).toContainText("整流子");
    await expect(info).toContainText("せいりゅうし");
    await expect(info).toContainText("電流の向きを切り替える");
  });

  test("選んだ番号をもう一度選ぶと解説を閉じる", async ({ page }) => {
    const label = page.getByRole("button", { name: "4 シャフト" });
    await label.click();
    await expect(label).toHaveAttribute("aria-pressed", "true");
    await label.click();
    await expect(label).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#part-info")).toBeHidden();
  });

  test("Escape キーで解説を閉じる", async ({ page }) => {
    await page.getByRole("button", { name: "2 モーターケース" }).click();
    await expect(page.locator("#part-info")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#part-info")).toBeHidden();
  });

  test("組み立てると番号を隠し，ボタンの表記が切り替わる", async ({ page }) => {
    await page.getByRole("button", { name: "組み立てる" }).click();
    await expect(page.getByLabel("展開の度合い")).toHaveValue("0");
    await expect(page.locator("#labels button").first()).toBeHidden();
    await expect(page.getByRole("button", { name: "展開する" })).toBeVisible();
  });

  test("スライダーで展開の度合いを変えられる", async ({ page }) => {
    const slider = page.getByLabel("展開の度合い");
    await slider.fill("0");
    await expect(page.locator("#labels button").first()).toBeHidden();
    await slider.fill("100");
    await expect(page.locator("#labels button").first()).toBeVisible();
  });

  test("部品一覧から部品を選べる", async ({ page }) => {
    await page.locator("#parts-panel summary").click();
    await page
      .locator("#parts-list")
      .getByRole("button", { name: /永久磁石/ })
      .click();
    await expect(page.locator("#part-info")).toContainText(
      "回転に必要な磁界をつくる",
    );
  });

  test("3D 上の部品を押すと，その部品の解説を表示する", async ({ page }) => {
    const canvas = page.locator("canvas#scene");
    const box = await canvas.boundingBox();
    if (box === null) {
      throw new Error("描画領域の位置を取得できない");
    }
    // 画面の中央には，展開しても動かない回転子がある．
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    const info = page.locator("#part-info");
    await expect(info).toBeVisible();
    await expect(info.locator(".part-info__name")).toHaveText(
      /シャフト|電機子鉄心|巻線/,
    );
  });

  test("キーボードだけで部品の解説を表示できる", async ({ page }) => {
    const label = page.getByRole("button", { name: "1 軸受" });
    // 先頭の操作部品から順にたどり，番号のボタンへ到達できることを確かめる．
    for (let presses = 0; presses < 5; presses += 1) {
      await page.keyboard.press("Tab");
      if (
        await label.evaluate((element) => element === document.activeElement)
      ) {
        break;
      }
    }
    await expect(label).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#part-info")).toContainText(
      "シャフトを支えて滑らかに回す",
    );
    await expect(page.locator("#announcer")).toContainText("軸受");
  });

  test("矢印キーで視点が回り，番号の位置が変わる", async ({ page }) => {
    const label = page.getByRole("button", { name: "1 軸受" });
    const before = await label.boundingBox();
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await label.boundingBox())?.x)
      .not.toBe(before?.x);
  });

  test("スライダーの操作中は矢印キーで視点が回らない", async ({ page }) => {
    const label = page.getByRole("button", { name: "10 エンドベル" });
    const slider = page.getByLabel("展開の度合い");
    await slider.focus();
    const before = await label.boundingBox();
    await page.keyboard.press("ArrowLeft");
    await expect(slider).toHaveValue("99");
    await page.keyboard.press("ArrowRight");
    await expect(slider).toHaveValue("100");
    expect((await label.boundingBox())?.x).toBeCloseTo(before?.x ?? 0, 0);
  });

  test("横スクロールが発生しない", async ({ page }) => {
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("自動検査でアクセシビリティの違反を検出しない", async ({ page }) => {
    await page.getByRole("button", { name: "7 整流子" }).click();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test("マウスを部品へ重ねると解説を表示する", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "マウス操作の検証である");
  await openSite(page);
  const canvas = page.locator("canvas#scene");
  const box = await canvas.boundingBox();
  if (box === null) {
    throw new Error("描画領域の位置を取得できない");
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator("#part-info")).toBeVisible();
  await page.mouse.move(box.x + 4, box.y + 4);
  await expect(page.locator("#part-info")).toBeHidden();
});

test("読み込み後にアニメーションで展開し，ボタンで組み立てへ戻せる", async ({
  page,
}) => {
  await page.goto("./");
  const slider = page.getByLabel("展開の度合い");
  // GPU のない環境では 3D の初期化と描画に時間がかかるため，待ち時間を延ばす．
  await expect(slider).toHaveValue("100", { timeout: ANIMATION_TIMEOUT_MS });
  await page.getByRole("button", { name: "組み立てる" }).click();
  await expect(slider).toHaveValue("0", { timeout: ANIMATION_TIMEOUT_MS });
  await expect(page.getByRole("button", { name: "展開する" })).toBeVisible();
});
