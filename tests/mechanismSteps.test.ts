import { describe, expect, test } from "vitest";
import { MECHANISM_STEPS } from "../src/motor/mechanismSteps";

const TITLE_MAX_LENGTH = 16;
const DESCRIPTION_MAX_LENGTH = 130;
const eachStep = MECHANISM_STEPS.map((step, index) => ({
  number: index + 1,
  step,
}));

describe("回るしくみの段階", () => {
  test("電源の接続から回り続けるまでを，5 段階以上で説明する", () => {
    expect(MECHANISM_STEPS.length).toBeGreaterThanOrEqual(5);
  });

  test("最初の段階は電源の接続から始まる", () => {
    expect(MECHANISM_STEPS[0]?.title).toContain("電源");
  });

  test("最後の段階は回り続ける理由を説明する", () => {
    expect(MECHANISM_STEPS.at(-1)?.title).toContain("回り続ける");
  });

  test("段階の題はすべて異なる", () => {
    const titles = MECHANISM_STEPS.map((step) => step.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  test.each(eachStep)(
    "段階 $number の文章は欄に収まる長さである",
    ({ step }) => {
      expect(step.title.trim()).not.toBe("");
      expect(step.title.length).toBeLessThanOrEqual(TITLE_MAX_LENGTH);
      expect(step.description.trim()).not.toBe("");
      expect(step.description.length).toBeLessThanOrEqual(
        DESCRIPTION_MAX_LENGTH,
      );
    },
  );

  test("電流は，段階が進むにつれて端子から巻線へ届く", () => {
    const order = ["none", "brushes", "coils"];
    const reaches = MECHANISM_STEPS.map((step) =>
      order.indexOf(step.currentReach),
    );
    expect(reaches).toEqual([...reaches].sort((a, b) => a - b));
    expect(MECHANISM_STEPS[0]?.currentReach).toBe("brushes");
    expect(MECHANISM_STEPS.at(-1)?.currentReach).toBe("coils");
  });

  test.each(eachStep)(
    "段階 $number で極や力を示すのは，巻線へ電流が届いた後である",
    ({ step }) => {
      if (step.showsPoles || step.showsForces || step.rotationSpeed > 0) {
        expect(step.currentReach).toBe("coils");
      }
      if (step.showsForces) {
        expect(step.showsPoles).toBe(true);
      }
    },
  );

  test("回転を見せるのは，力の説明より後の段階である", () => {
    const firstForce = MECHANISM_STEPS.findIndex((step) => step.showsForces);
    const firstRotation = MECHANISM_STEPS.findIndex(
      (step) => step.rotationSpeed > 0,
    );
    expect(firstForce).toBeGreaterThanOrEqual(0);
    expect(firstRotation).toBeGreaterThan(firstForce);
  });

  test.each(eachStep)("段階 $number の回す速さは 0 以上である", ({ step }) => {
    expect(step.rotationSpeed).toBeGreaterThanOrEqual(0);
  });
});
