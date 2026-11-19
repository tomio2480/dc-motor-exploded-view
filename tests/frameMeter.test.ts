import { describe, expect, test } from "vitest";
import { createFrameMeter } from "../src/view/frameMeter";

const WINDOW_SIZE = 4;
const MAX_GAP_MS = 100;

describe("createFrameMeter", () => {
  test("記録がなければ値を返さない", () => {
    const meter = createFrameMeter(WINDOW_SIZE, MAX_GAP_MS);
    expect(meter.typicalIntervalMs()).toBeNull();
  });

  test("1 回の記録だけでは間隔が決まらない", () => {
    const meter = createFrameMeter(WINDOW_SIZE, MAX_GAP_MS);
    meter.record(1000);
    expect(meter.typicalIntervalMs()).toBeNull();
  });

  test("連続したフレームの間隔の中央値を返す", () => {
    const meter = createFrameMeter(WINDOW_SIZE, MAX_GAP_MS);
    for (const time of [0, 10, 30, 60]) {
      meter.record(time);
    }
    expect(meter.typicalIntervalMs()).toBeCloseTo(20);
  });

  test("直近の指定した数の間隔だけを使う", () => {
    const meter = createFrameMeter(WINDOW_SIZE, MAX_GAP_MS);
    for (const time of [0, 50, 60, 70, 80, 90]) {
      meter.record(time);
    }
    expect(meter.typicalIntervalMs()).toBeCloseTo(10);
  });

  test("操作の合間の短い停止が混ざっても，値が大きく動かない", () => {
    const meter = createFrameMeter(5, 1000);
    for (const time of [0, 16, 32, 48, 64, 664]) {
      meter.record(time);
    }
    expect(meter.typicalIntervalMs()).toBeCloseTo(16);
  });

  test("描画が遅く間隔が長い場合も，上限までは測る", () => {
    const meter = createFrameMeter(WINDOW_SIZE, 1000);
    for (const time of [0, 400, 800, 1200]) {
      meter.record(time);
    }
    expect(meter.typicalIntervalMs()).toBeCloseTo(400);
  });

  test("描画が止まっていた間は，間隔として数えない", () => {
    const meter = createFrameMeter(WINDOW_SIZE, MAX_GAP_MS);
    for (const time of [0, 16, 32, 5000, 5020, 5040]) {
      meter.record(time);
    }
    expect(meter.typicalIntervalMs()).toBeCloseTo(20);
  });

  test.each([{ size: 0 }, { size: -1 }, { size: 1.5 }])(
    "使う間隔の数 $size は拒否する",
    ({ size }) => {
      expect(() => createFrameMeter(size, MAX_GAP_MS)).toThrow(RangeError);
    },
  );
});
