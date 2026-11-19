import { describe, expect, test } from "vitest";
import {
  type ArmatureShape,
  armatureProfile,
  flattedCircleProfile,
  type Point2,
  ringSectorProfile,
  signedArea,
} from "../src/motor/profiles";

const EPSILON = 1e-9;

function radiusOf(point: Point2): number {
  return Math.hypot(point[0], point[1]);
}

function containsPoint(points: readonly Point2[], target: Point2): boolean {
  return points.some(
    (point) =>
      Math.abs(point[0] - target[0]) < 1e-6 &&
      Math.abs(point[1] - target[1]) < 1e-6,
  );
}

describe("signedArea", () => {
  test("反時計回りの正方形は正の面積を返す", () => {
    const square: Point2[] = [
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ];
    expect(signedArea(square)).toBeCloseTo(4);
  });

  test("時計回りの正方形は負の面積を返す", () => {
    const square: Point2[] = [
      [0, 0],
      [0, 2],
      [2, 2],
      [2, 0],
    ];
    expect(signedArea(square)).toBeCloseTo(-4);
  });
});

describe("flattedCircleProfile", () => {
  const radius = 10;
  const flatHalf = 6;
  const profile = flattedCircleProfile(radius, flatHalf, 16);

  test("すべての点が円の内側かつ平面の間にある", () => {
    for (const point of profile) {
      expect(radiusOf(point)).toBeLessThanOrEqual(radius + EPSILON);
      expect(Math.abs(point[1])).toBeLessThanOrEqual(flatHalf + EPSILON);
    }
  });

  test("曲面の頂点と平面の端を含む", () => {
    expect(containsPoint(profile, [radius, 0])).toBe(true);
    expect(containsPoint(profile, [-radius, 0])).toBe(true);
    expect(containsPoint(profile, [8, flatHalf])).toBe(true);
    expect(containsPoint(profile, [-8, -flatHalf])).toBe(true);
  });

  test("反時計回りで，円より小さい面積を囲む", () => {
    const area = signedArea(profile);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeLessThan(Math.PI * radius ** 2);
    expect(area).toBeGreaterThan(2 * flatHalf * 2 * 8);
  });

  test("原点について点対称である", () => {
    for (const point of profile) {
      expect(containsPoint(profile, [-point[0], -point[1]])).toBe(true);
    }
  });

  test.each([
    { radius: 10, flatHalf: 10 },
    { radius: 10, flatHalf: 12 },
    { radius: 10, flatHalf: 0 },
    { radius: 0, flatHalf: 1 },
  ])(
    "半径 $radius・平面までの距離 $flatHalf は拒否する",
    ({ radius: r, flatHalf: f }) => {
      expect(() => flattedCircleProfile(r, f, 16)).toThrow(RangeError);
    },
  );
});

describe("ringSectorProfile", () => {
  const sector = {
    innerRadius: 7,
    outerRadius: 9,
    centerAngle: Math.PI / 2,
    halfSpan: Math.PI / 4,
    segments: 12,
  };
  const profile = ringSectorProfile(sector);

  test("すべての点が内径と外径の間にある", () => {
    for (const point of profile) {
      const radius = radiusOf(point);
      expect(radius).toBeGreaterThanOrEqual(sector.innerRadius - EPSILON);
      expect(radius).toBeLessThanOrEqual(sector.outerRadius + EPSILON);
    }
  });

  test("すべての点が開き角の内側にある", () => {
    for (const point of profile) {
      const angle = Math.atan2(point[1], point[0]);
      expect(Math.abs(angle - sector.centerAngle)).toBeLessThanOrEqual(
        sector.halfSpan + EPSILON,
      );
    }
  });

  test("扇形の面積と一致する向きと大きさを持つ", () => {
    const expected =
      sector.halfSpan * (sector.outerRadius ** 2 - sector.innerRadius ** 2);
    const area = signedArea(profile);
    expect(area).toBeGreaterThan(0);
    expect(area).toBeCloseTo(expected, 0);
  });

  test("内径が外径以上なら拒否する", () => {
    expect(() =>
      ringSectorProfile({ ...sector, innerRadius: 9, outerRadius: 9 }),
    ).toThrow(RangeError);
  });
});

describe("armatureProfile", () => {
  const shape: ArmatureShape = {
    poleCount: 3,
    hubRadius: 2.6,
    stemHalfWidth: 1.3,
    headInnerRadius: 5.6,
    headOuterRadius: 7.3,
    headHalfSpan: (46 * Math.PI) / 180,
    startAngle: Math.PI / 2,
    segments: 8,
  };
  const profile = armatureProfile(shape);

  test("すべての点がハブの外周から突起の外周までにある", () => {
    for (const point of profile) {
      const radius = radiusOf(point);
      expect(radius).toBeGreaterThanOrEqual(shape.hubRadius - 1e-6);
      expect(radius).toBeLessThanOrEqual(shape.headOuterRadius + 1e-6);
    }
  });

  test("最初の突起の先端が開始角の方向にある", () => {
    expect(containsPoint(profile, [0, shape.headOuterRadius])).toBe(true);
  });

  test("極数ぶんの回転対称である", () => {
    const step = (2 * Math.PI) / shape.poleCount;
    const cos = Math.cos(step);
    const sin = Math.sin(step);
    for (const point of profile) {
      const rotated: Point2 = [
        point[0] * cos - point[1] * sin,
        point[0] * sin + point[1] * cos,
      ];
      expect(containsPoint(profile, rotated)).toBe(true);
    }
  });

  test("反時計回りで，ハブより大きく外周の円より小さい面積を囲む", () => {
    const area = signedArea(profile);
    expect(area).toBeGreaterThan(Math.PI * shape.hubRadius ** 2);
    expect(area).toBeLessThan(Math.PI * shape.headOuterRadius ** 2);
  });

  test("突起の先端どうしが重なる開き角は拒否する", () => {
    expect(() =>
      armatureProfile({ ...shape, headHalfSpan: Math.PI / 3 }),
    ).toThrow(RangeError);
  });

  test("柱がハブより太い場合は拒否する", () => {
    expect(() => armatureProfile({ ...shape, stemHalfWidth: 2.6 })).toThrow(
      RangeError,
    );
  });
});
