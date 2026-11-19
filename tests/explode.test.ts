import { describe, expect, test } from "vitest";
import {
  approach,
  clampFactor,
  explodedOffset,
  LABEL_FADE_END,
  LABEL_FADE_START,
  labelOpacity,
} from "../src/view/explode";

describe("clampFactor", () => {
  test.each([{ value: 0 }, { value: 0.4 }, { value: 1 }])(
    "範囲内の $value はそのまま返す",
    ({ value }) => {
      expect(clampFactor(value)).toBe(value);
    },
  );

  test("負の値は 0 へ丸める", () => {
    expect(clampFactor(-0.2)).toBe(0);
  });

  test("1 を超える値は 1 へ丸める", () => {
    expect(clampFactor(1.5)).toBe(1);
  });

  test.each([
    { value: Number.NaN },
    { value: Number.POSITIVE_INFINITY },
    { value: Number.NEGATIVE_INFINITY },
  ])("有限でない $value は拒否する", ({ value }) => {
    expect(() => clampFactor(value)).toThrow(RangeError);
  });
});

describe("explodedOffset", () => {
  const offset = [10, -4, 2] as const;

  test("展開度 0 では移動しない", () => {
    expect(explodedOffset(offset, 0)).toEqual([0, 0, 0]);
  });

  test("展開度 1 では移動量そのものを返す", () => {
    expect(explodedOffset(offset, 1)).toEqual([10, -4, 2]);
  });

  test("展開度 0.5 では半分だけ移動する", () => {
    expect(explodedOffset(offset, 0.5)).toEqual([5, -2, 1]);
  });

  test("範囲外の展開度は端の値として扱う", () => {
    expect(explodedOffset(offset, 2)).toEqual([10, -4, 2]);
  });
});

describe("labelOpacity", () => {
  test("フェード開始より手前では 0", () => {
    expect(labelOpacity(LABEL_FADE_START)).toBe(0);
    expect(labelOpacity(0)).toBe(0);
  });

  test("フェード終了以降では 1", () => {
    expect(labelOpacity(LABEL_FADE_END)).toBe(1);
    expect(labelOpacity(1)).toBe(1);
  });

  test("区間の中央では 0.5", () => {
    const middle = (LABEL_FADE_START + LABEL_FADE_END) / 2;
    expect(labelOpacity(middle)).toBeCloseTo(0.5);
  });
});

describe("approach", () => {
  test("目標へ向かって最大変化量だけ増える", () => {
    expect(approach(0.2, 1, 0.1)).toBeCloseTo(0.3);
  });

  test("目標へ向かって最大変化量だけ減る", () => {
    expect(approach(0.8, 0, 0.1)).toBeCloseTo(0.7);
  });

  test("目標を通り過ぎない", () => {
    expect(approach(0.95, 1, 0.1)).toBe(1);
    expect(approach(0.05, 0, 0.1)).toBe(0);
  });

  test("負の最大変化量は拒否する", () => {
    expect(() => approach(0, 1, -0.1)).toThrow(RangeError);
  });
});
