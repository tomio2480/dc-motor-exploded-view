import { describe, expect, test } from "vitest";
import { smoothingFactor } from "../src/view/ease";

describe("smoothingFactor", () => {
  test("時間が経過していなければ進まない", () => {
    expect(smoothingFactor(0, 200)).toBe(0);
  });

  test("時定数と同じ時間で，残りの約 63% を進む", () => {
    expect(smoothingFactor(200, 200)).toBeCloseTo(1 - 1 / Math.E);
  });

  test("十分に長い時間では，ほぼ目標へ達する", () => {
    expect(smoothingFactor(5000, 200)).toBeGreaterThan(0.999);
    expect(smoothingFactor(5000, 200)).toBeLessThanOrEqual(1);
  });

  test("経過時間が長いほど大きく進む", () => {
    expect(smoothingFactor(32, 200)).toBeGreaterThan(smoothingFactor(16, 200));
  });

  test.each([{ elapsed: -1 }, { elapsed: Number.NaN }])(
    "経過時間 $elapsed は拒否する",
    ({ elapsed }) => {
      expect(() => smoothingFactor(elapsed, 200)).toThrow(RangeError);
    },
  );

  test.each([{ timeConstant: 0 }, { timeConstant: -10 }])(
    "時定数 $timeConstant は拒否する",
    ({ timeConstant }) => {
      expect(() => smoothingFactor(16, timeConstant)).toThrow(RangeError);
    },
  );
});
