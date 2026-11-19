import { describe, expect, test } from "vitest";
import { fitDistance, type ViewBasis, viewBasis } from "../src/view/cameraFit";

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

describe("viewBasis", () => {
  function expectVector(
    actual: readonly number[],
    expected: readonly number[],
  ) {
    actual.forEach((value, index) => {
      expect(value).toBeCloseTo(expected[index] ?? Number.NaN);
    });
  }

  test("正面から見るとき，右は x 軸，上は y 軸になる", () => {
    const basis = viewBasis([0, 0, 1]);
    expectVector(basis.right, [1, 0, 0]);
    expectVector(basis.up, [0, 1, 0]);
    expectVector(basis.toCamera, [0, 0, 1]);
  });

  test("右側から見るとき，画面の右は奥行きの負の向きになる", () => {
    const basis = viewBasis([1, 0, 0]);
    expectVector(basis.right, [0, 0, -1]);
    expectVector(basis.up, [0, 1, 0]);
  });

  test("長さが 1 でない方向も，単位ベクトルの基底にする", () => {
    const basis = viewBasis([0, 3, 4]);
    expectVector(basis.toCamera, [0, 0.6, 0.8]);
    expectVector(basis.right, [1, 0, 0]);
    expectVector(basis.up, [0, 0.8, -0.6]);
  });

  test.each([
    { direction: [0, 1, 0] as const },
    { direction: [0, -2, 0] as const },
    { direction: [0, 0, 0] as const },
  ])("真上・真下・長さ 0 の方向 $direction は拒否する", ({ direction }) => {
    expect(() => viewBasis(direction)).toThrow(RangeError);
  });
});
