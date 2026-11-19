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

async function canvasCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await page.locator("canvas#scene").boundingBox();
  if (box === null) {
    throw new Error("描画領域の位置を取得できない");
  }
  // 画面の中央には，展開しても動かない回転子がある．
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** 2 つの番号ラベルの間隔を，表示の拡大率の目安として返す． */
async function labelSpan(page: Page): Promise<number> {
  // 領域の大きさの変化が描画と番号の配置へ反映されるまで，2 フレーム待つ．
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
  const first = await page
    .getByRole("button", { name: "1 軸受" })
    .boundingBox();
  const last = await page
    .getByRole("button", { name: "10 エンドベル" })
    .boundingBox();
  if (first === null || last === null) {
    throw new Error("番号ラベルの位置を取得できない");
  }
  return Math.hypot(first.x - last.x, first.y - last.y);
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
    const center = await canvasCenter(page);
    await page.mouse.click(center.x, center.y);
    const info = page.locator("#part-info");
    await expect(info).toBeVisible();
    await expect(info.locator(".part-info__name")).toHaveText(
      /シャフト|電機子鉄心|巻線/,
    );
  });

  test("部品一覧から選ぶと，フォーカスが一覧の見出しへ戻る", async ({
    page,
  }) => {
    const summary = page.locator("#parts-panel summary");
    await summary.click();
    await page
      .locator("#parts-list")
      .getByRole("button", { name: /端子/ })
      .click();
    await expect(summary).toBeFocused();
  });

  test("解説を閉じると，フォーカスが選んでいた部品の番号へ戻る", async ({
    page,
  }) => {
    const label = page.getByRole("button", { name: "8 ブラシ" });
    await label.click();
    await page.getByRole("button", { name: "解説を閉じる" }).click();
    await expect(page.locator("#part-info")).toBeHidden();
    await expect(label).toBeFocused();
  });

  test("解説の表示で領域の大きさが変わっても，拡大した状態を保つ", async ({
    page,
  }) => {
    const label = page.getByRole("button", { name: "4 シャフト" });
    const fittedSpan = await labelSpan(page);
    await label.click();
    const fittedSpanWithInfo = await labelSpan(page);
    await page.keyboard.press("Escape");

    await page.keyboard.press("+");
    await page.keyboard.press("+");
    const zoomedSpan = await labelSpan(page);
    expect(zoomedSpan).toBeGreaterThan(fittedSpan * 1.2);

    await label.click();
    const zoomedSpanWithInfo = await labelSpan(page);
    // 領域が変わった分の比率だけが変わり，拡大の倍率は変わらない．
    expect(zoomedSpanWithInfo / zoomedSpan).toBeCloseTo(
      fittedSpanWithInfo / fittedSpan,
      1,
    );
  });

  test("画面が小さいときは縦にスクロールして操作できる", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    const stage = await page.locator("#stage").boundingBox();
    expect(stage?.height).toBeGreaterThanOrEqual(200);
    const toggle = page.getByRole("button", { name: "組み立てる" });
    await toggle.scrollIntoViewIfNeeded();
    await expect(toggle).toBeInViewport();
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

test.describe("マウスでの操作", () => {
  test.skip(({ isMobile }) => isMobile, "マウス操作の検証である");

  test.beforeEach(async ({ page }) => {
    await openSite(page);
  });

  test("部品へ重ねると吹き出しを表示し，離すと閉じる", async ({ page }) => {
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await expect(page.locator("#part-tooltip")).toBeVisible();
    await expect(page.locator("#part-info")).toBeHidden();
    await page.mouse.move(center.x - 200, center.y - 200);
    await expect(page.locator("#part-tooltip")).toBeHidden();
  });

  test("解説を固定したまま別の部品へ重ねても，固定した解説は変わらない", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "10 エンドベル" }).click();
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await expect(page.locator("#part-tooltip")).toBeVisible();
    await expect(page.locator("#part-info .part-info__name")).toHaveText(
      "エンドベル",
    );
  });

  test("視点をドラッグし始めると吹き出しを閉じる", async ({ page }) => {
    const center = await canvasCenter(page);
    await page.mouse.move(center.x, center.y);
    await expect(page.locator("#part-tooltip")).toBeVisible();
    await page.mouse.down();
    await page.mouse.move(center.x + 60, center.y + 20, { steps: 4 });
    await expect(page.locator("#part-tooltip")).toBeHidden();
    await page.mouse.up();
    await expect(page.locator("#part-info")).toBeHidden();
  });

  test("右クリックでは部品を選択しない", async ({ page }) => {
    const center = await canvasCenter(page);
    await page.mouse.click(center.x, center.y, { button: "right" });
    await expect(page.locator("#part-info")).toBeHidden();
  });
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

test("WebGL を使えない環境では，部品の解説を文章で表示する", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = () => null;
  });
  await page.goto("./");
  await expect(page.getByRole("alert")).toContainText("3D を表示できません");
  const fallback = page.locator("#fallback-parts");
  await expect(fallback.getByRole("listitem")).toHaveCount(PART_COUNT);
  await expect(fallback).toContainText("電流の向きを切り替える");
  await expect(page.locator("#labels button")).toHaveCount(0);
  await expect(page.locator(".controls")).toBeHidden();
});
