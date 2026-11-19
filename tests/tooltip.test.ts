import { describe, expect, test } from "vitest";
import { placeTooltip } from "../src/ui/tooltip";

const size = { width: 200, height: 100 };
const viewport = { width: 1000, height: 600 };
const gap = 16;

describe("placeTooltip", () => {
  test("余裕があればポインターの右下へ置く", () => {
    const placement = placeTooltip({
      pointer: { x: 300, y: 200 },
      size,
      viewport,
      gap,
    });
    expect(placement).toEqual({ left: 316, top: 216 });
  });

  test("右端からはみ出すときは左側へ置く", () => {
    const placement = placeTooltip({
      pointer: { x: 900, y: 200 },
      size,
      viewport,
      gap,
    });
    expect(placement).toEqual({ left: 684, top: 216 });
  });

  test("下端からはみ出すときは上側へ置く", () => {
    const placement = placeTooltip({
      pointer: { x: 300, y: 550 },
      size,
      viewport,
      gap,
    });
    expect(placement).toEqual({ left: 316, top: 434 });
  });

  test("どちら側にも収まらないときは画面内へ収める", () => {
    const narrow = { width: 220, height: 120 };
    const placement = placeTooltip({
      pointer: { x: 110, y: 60 },
      size,
      viewport: narrow,
      gap,
    });
    expect(placement.left).toBeGreaterThanOrEqual(0);
    expect(placement.top).toBeGreaterThanOrEqual(0);
    expect(placement.left + size.width).toBeLessThanOrEqual(narrow.width);
    expect(placement.top + size.height).toBeLessThanOrEqual(narrow.height);
  });

  test("画面端との間に余白を保つ", () => {
    const placement = placeTooltip({
      pointer: { x: 990, y: 590 },
      size,
      viewport,
      gap,
    });
    expect(placement.left + size.width).toBeLessThanOrEqual(1000 - gap);
    expect(placement.top + size.height).toBeLessThanOrEqual(600 - gap);
  });
});
