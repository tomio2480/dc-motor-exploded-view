import { describe, expect, test } from "vitest";
import { fitDistance, type ViewBasis } from "../src/view/cameraFit";

const basis: ViewBasis = {
  right: [1, 0, 0],
  up: [0, 1, 0],
  toCamera: [0, 0, 1],
};
const FOV_90 = Math.PI / 2;

describe("fitDistance", () => {
  test("上方向の点が画角の端に来る距離を返す", () => {
    expect(fitDistance([[0, 1, 0]], basis, FOV_90, 1)).toBeCloseTo(1);
  });

  test("下方向の点も同じ距離で収まる", () => {
    expect(fitDistance([[0, -1, 0]], basis, FOV_90, 1)).toBeCloseTo(1);
  });

  test("横方向は縦横比の分だけ近づける", () => {
    expect(fitDistance([[2, 0, 0]], basis, FOV_90, 2)).toBeCloseTo(1);
  });

  test("縦長の画面では横方向の点のために遠ざかる", () => {
    expect(fitDistance([[1, 0, 0]], basis, FOV_90, 0.5)).toBeCloseTo(2);
  });

  test("カメラ側へ出ている点はその分だけ遠ざかる", () => {
    expect(fitDistance([[0, 1, 3]], basis, FOV_90, 1)).toBeCloseTo(4);
  });

  test("複数の点のうち最も遠い距離を採る", () => {
    const points = [
      [0, 1, 0],
      [0, 3, 0],
      [0.5, 0, 0],
    ] as const;
    expect(fitDistance(points, basis, FOV_90, 1)).toBeCloseTo(3);
  });

  test("点がなければ拒否する", () => {
    expect(() => fitDistance([], basis, FOV_90, 1)).toThrow(RangeError);
  });

  test.each([{ aspect: 0 }, { aspect: -1 }, { aspect: Number.NaN }])(
    "縦横比 $aspect は拒否する",
    ({ aspect }) => {
      expect(() => fitDistance([[0, 1, 0]], basis, FOV_90, aspect)).toThrow(
        RangeError,
      );
    },
  );
});
