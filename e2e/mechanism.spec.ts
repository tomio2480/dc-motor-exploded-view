import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { openSite } from "./helpers";

const STEP_COUNT = 6;
const ANIMATION_TIMEOUT_MS = 20_000;
const SLOW_TEST_TIMEOUT_MS = 120_000;

function marker(page: Page, id: string): Locator {
  return page.locator(`#markers [data-marker="${id}"]`);
}

async function openMechanism(page: Page): Promise<void> {
  await openSite(page);
  await page.getByRole("tab", { name: "回るしくみ" }).click();
  await expect(page.locator("#step-info")).toBeVisible();
}

async function goToStep(page: Page, number: number): Promise<void> {
  const next = page.getByRole("button", { name: "次へ" });
  for (let current = 1; current < number; current += 1) {
    await next.click();
  }
  await expect(page.locator("#step-position")).toHaveText(
    `${number} / ${STEP_COUNT}`,
  );
}

test.describe("表示の切り替え", () => {
  test.beforeEach(async ({ page }) => {
    await openSite(page);
  });

  test("最初は「部品を知る」を選んでいる", async ({ page }) => {
    await expect(page.getByRole("tab", { name: "部品を知る" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("tab", { name: "回るしくみ" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    await expect(page.locator("#step-info")).toBeHidden();
  });

  test("「回るしくみ」へ切り替えると，段階の説明と専用の操作を表示する", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "回るしくみ" }).click();
    await expect(page.locator("#step-info")).toContainText("電源をつなぐ");
    await expect(page.locator("#step-position")).toHaveText(
      `1 / ${STEP_COUNT}`,
    );
    await expect(page.getByRole("button", { name: "次へ" })).toBeVisible();
    await expect(page.getByLabel("展開の度合い")).toBeHidden();
    await expect(page.locator("#labels button").first()).toBeHidden();
    await expect(page.locator("#parts-panel")).toBeHidden();
  });

  test("「部品を知る」へ戻ると，番号と展開の操作が戻る", async ({ page }) => {
    await page.getByRole("tab", { name: "回るしくみ" }).click();
    await page.getByRole("tab", { name: "部品を知る" }).click();
    await expect(page.locator("#step-info")).toBeHidden();
    await expect(page.getByLabel("展開の度合い")).toHaveValue("100");
    await expect(page.locator("#labels button").first()).toBeVisible();
    await expect(page.locator("#markers")).toBeHidden();
  });

  test("選んでいた部品の解説は，切り替えると閉じる", async ({ page }) => {
    await page.getByRole("button", { name: "7 整流子" }).click();
    await page.getByRole("tab", { name: "回るしくみ" }).click();
    await expect(page.locator("#part-info")).toBeHidden();
  });

  test("選択中のタブをもう一度押しても，開いている解説を閉じない", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "7 整流子" }).click();
    await page.getByRole("tab", { name: "部品を知る" }).click();
    await expect(page.locator("#part-info")).toBeVisible();
  });

  test("3D の表示の名前は，選んだタブに合わせて変わる", async ({ page }) => {
    await expect(page.getByRole("img", { name: /展開図/ })).toBeVisible();
    await page.getByRole("tab", { name: "回るしくみ" }).click();
    await expect(page.getByRole("img", { name: /回るしくみ/ })).toBeVisible();
    await expect(
      page.getByRole("img", { name: /回るしくみ/ }),
    ).toHaveAccessibleDescription(/前へ.*次へ/);
  });

  test("値の表示は，読み上げ用の領域として扱わない", async ({ page }) => {
    // スライダーの値は aria-valuetext で伝える．値の表示が変わるたびに読み上げない．
    await expect(page.getByRole("status")).toHaveCount(0);
  });

  test("タブは矢印キーで切り替えられる", async ({ page }) => {
    const partsTab = page.getByRole("tab", { name: "部品を知る" });
    const mechanismTab = page.getByRole("tab", { name: "回るしくみ" });
    await partsTab.focus();
    await page.keyboard.press("ArrowRight");
    await expect(mechanismTab).toBeFocused();
    await expect(mechanismTab).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("ArrowLeft");
    await expect(partsTab).toHaveAttribute("aria-selected", "true");
  });
});

test.describe("回るしくみ", () => {
  test.beforeEach(async ({ page }) => {
    await openMechanism(page);
  });

  test("最初の段階では「前へ」を，最後の段階では「次へ」を押せない", async ({
    page,
  }) => {
    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await goToStep(page, STEP_COUNT);
    await expect(page.getByRole("button", { name: "次へ" })).toBeDisabled();
    await expect(page.locator("#step-info")).toContainText("回り続ける");
  });

  test("端の段階で押せなくなったボタンから，フォーカスを反対のボタンへ移す", async ({
    page,
  }) => {
    await goToStep(page, STEP_COUNT);
    await expect(page.getByRole("button", { name: "前へ" })).toBeFocused();
    for (let step = STEP_COUNT; step > 1; step -= 1) {
      await page.getByRole("button", { name: "前へ" }).click();
    }
    await expect(page.getByRole("button", { name: "次へ" })).toBeFocused();
  });

  test("「前へ」で前の段階へ戻る", async ({ page }) => {
    await goToStep(page, 3);
    await page.getByRole("button", { name: "前へ" }).click();
    await expect(page.locator("#step-info")).toContainText(
      "整流子から巻線へ流れる",
    );
  });

  test("端子には電源の向きを示す記号を付ける", async ({ page }) => {
    await expect(marker(page, "terminal-upper")).toHaveText("＋");
    await expect(marker(page, "terminal-lower")).toHaveText("－");
  });

  test("極の記号は，巻線が電磁石になる段階から表示する", async ({ page }) => {
    await expect(marker(page, "pole-0")).toBeHidden();
    await goToStep(page, 3);
    await expect(marker(page, "pole-0")).toHaveText("N");
    await expect(marker(page, "magnet-upper")).toHaveText("N");
    await expect(marker(page, "magnet-lower")).toHaveText("S");
  });

  test("回転子の角度を変えると，突起の極が入れ替わる", async ({ page }) => {
    await goToStep(page, 3);
    const angle = page.getByLabel("回転子の角度");
    await angle.fill("0");
    await expect(marker(page, "pole-0")).toHaveText("N");
    await angle.fill("180");
    await expect(marker(page, "pole-0")).toHaveText("S");
  });

  test("電源を逆につなぐと，端子の記号と突起の極が逆になる", async ({
    page,
  }) => {
    await goToStep(page, 3);
    const reverse = page.getByRole("button", { name: "電源を逆につなぐ" });
    await reverse.click();
    await expect(reverse).toHaveAttribute("aria-pressed", "true");
    await expect(marker(page, "terminal-upper")).toHaveText("－");
    await expect(marker(page, "pole-0")).toHaveText("S");
    await reverse.click();
    await expect(marker(page, "pole-0")).toHaveText("N");
  });

  test("動きを減らす設定では，回す操作をするまで回転子を回さない", async ({
    page,
  }) => {
    await goToStep(page, 5);
    const angle = page.getByLabel("回転子の角度");
    await expect(angle).toHaveValue("0");
    await page.getByRole("button", { name: "回す" }).click();
    await expect(angle).not.toHaveValue("0", { timeout: ANIMATION_TIMEOUT_MS });
    await page.getByRole("button", { name: "止める" }).click();
    const stopped = await angle.inputValue();
    await expect(page.getByRole("button", { name: "回す" })).toBeVisible();
    await expect(angle).toHaveValue(stopped);
  });

  test("スライダーの操作中は矢印キーで角度が変わる", async ({ page }) => {
    const angle = page.getByLabel("回転子の角度");
    await angle.focus();
    await page.keyboard.press("ArrowRight");
    await expect(angle).not.toHaveValue("0");
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
    await goToStep(page, 4);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });
});

test("回転を見せる段階では，回転子が自動で回る", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#stage")).toHaveAttribute("data-ready", "true", {
    timeout: ANIMATION_TIMEOUT_MS,
  });
  await page.getByRole("tab", { name: "回るしくみ" }).click();
  await goToStep(page, 5);
  await expect(page.getByLabel("回転子の角度")).not.toHaveValue("0", {
    timeout: ANIMATION_TIMEOUT_MS,
  });
  await expect(page.getByRole("button", { name: "止める" })).toBeVisible();
});

test("段階を行き来しても，回転の更新は 1 フレームに 1 回だけ行う", async ({
  page,
}) => {
  // GPU のない環境では回転中の描画が遅く，操作のたびに時間がかかる．
  test.setTimeout(SLOW_TEST_TIMEOUT_MS);
  await page.goto("./");
  await expect(page.locator("#stage")).toHaveAttribute("data-ready", "true", {
    timeout: ANIMATION_TIMEOUT_MS,
  });
  await page.getByRole("tab", { name: "回るしくみ" }).click();
  await goToStep(page, 5);
  const next = page.getByRole("button", { name: "次へ" });
  const previous = page.getByRole("button", { name: "前へ" });
  // 不具合があると，段階を移るたびに回転を進める処理が 1 つずつ増える．
  await next.click();
  await previous.click();

  const FRAME_COUNT = 10;
  const updates = await page.evaluate(async (frameCount) => {
    const output = document.querySelector("#rotor-angle-output");
    if (output === null) {
      throw new Error("角度の表示が見つからない");
    }
    let count = 0;
    const observer = new MutationObserver((records) => {
      count += records.length;
    });
    observer.observe(output, { childList: true });
    for (let frame = 0; frame < frameCount; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    observer.disconnect();
    return count;
  }, FRAME_COUNT);
  expect(updates).toBeGreaterThan(0);
  expect(updates).toBeLessThanOrEqual(FRAME_COUNT + 1);
});
