import { describe, expect, test } from "vitest";
import {
  coilCurrents,
  poleAngle,
  segmentAngle,
  segmentContacts,
  torqueFactors,
} from "../src/motor/commutation";

const DEGREE = Math.PI / 180;
const POLE_STEP = 120 * DEGREE;
/** 接触が切り替わる境目を避けた，1 回転ぶんの角度． */
const SAMPLE_ANGLES = Array.from(
  { length: 360 },
  (_, index) => (index + 0.5) * DEGREE,
);

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

describe("poleAngle と segmentAngle", () => {
  test("回転していないとき，最初の突起は 90 度を向く", () => {
    expect(poleAngle(0)).toBeCloseTo(90 * DEGREE);
    expect(poleAngle(1)).toBeCloseTo(210 * DEGREE);
    expect(poleAngle(2)).toBeCloseTo(330 * DEGREE);
  });

  test("回転子の角度の分だけ突起の向きが進む", () => {
    expect(poleAngle(0, 30 * DEGREE)).toBeCloseTo(120 * DEGREE);
  });

  test("角度は 0 以上 360 度未満へそろえる", () => {
    expect(poleAngle(2, 60 * DEGREE)).toBeCloseTo(30 * DEGREE);
    expect(poleAngle(0, -100 * DEGREE)).toBeCloseTo(350 * DEGREE);
  });

  test("銅片は突起と次の突起の間にある", () => {
    expect(segmentAngle(0)).toBeCloseTo(150 * DEGREE);
    expect(segmentAngle(1)).toBeCloseTo(270 * DEGREE);
    expect(segmentAngle(2)).toBeCloseTo(30 * DEGREE);
  });

  test("突起の番号に -1 を渡すと，最後の突起と同じ向きになる", () => {
    expect(segmentAngle(-1)).toBeCloseTo(segmentAngle(2));
  });

  test("有限でない角度は拒否する", () => {
    expect(() => poleAngle(0, Number.NaN)).toThrow(RangeError);
  });
});

describe("segmentContacts", () => {
  test("上のブラシと下のブラシは，それぞれ別の銅片に触れる", () => {
    expect(segmentContacts(0)).toEqual(["lower", "none", "upper"]);
  });

  test("回転が進むと，触れる銅片が入れ替わる", () => {
    // 銅片の中心は 210 度，330 度，90 度へ進む．
    expect(segmentContacts(60 * DEGREE)).toEqual(["lower", "upper", "none"]);
  });

  test.each(
    SAMPLE_ANGLES.filter((_, index) => index % 15 === 0).map((angle) => ({
      angle,
    })),
  )("角度 $angle で，各ブラシにちょうど 1 枚ずつ触れる", ({ angle }) => {
    const contacts = segmentContacts(angle);
    expect(contacts.filter((contact) => contact === "upper")).toHaveLength(1);
    expect(contacts.filter((contact) => contact === "lower")).toHaveLength(1);
  });
});

describe("coilCurrents", () => {
  test("ブラシに触れる 2 枚の銅片の間の巻線へ，最も大きな電流が流れる", () => {
    expect(coilCurrents(0, 1)).toEqual([1, -0.5, -0.5]);
  });

  test("60 度進むと，次の巻線へ最も大きな電流が逆向きに流れる", () => {
    expect(coilCurrents(60 * DEGREE, 1)).toEqual([0.5, -1, 0.5]);
  });

  test("3 つの巻線は輪につながるため，電流の合計は 0 になる", () => {
    for (const angle of SAMPLE_ANGLES) {
      expect(sum(coilCurrents(angle, 1))).toBeCloseTo(0);
    }
  });

  test("突起が永久磁石の正面を過ぎるたびに，電流の向きが入れ替わる", () => {
    for (const angle of SAMPLE_ANGLES) {
      coilCurrents(angle, 1).forEach((current, pole) => {
        const side = Math.sin(poleAngle(pole, angle));
        expect(Math.sign(current)).toBe(Math.sign(side));
      });
    }
  });

  test("120 度進むと，隣の突起と同じ状態になる", () => {
    for (const angle of SAMPLE_ANGLES) {
      const before = coilCurrents(angle, 1);
      const after = coilCurrents(angle + POLE_STEP, 1);
      expect(after).toEqual([before[1], before[2], before[0]]);
    }
  });

  test("電源を逆につなぐと，すべての電流が逆になる", () => {
    for (const angle of SAMPLE_ANGLES) {
      const forward = coilCurrents(angle, 1);
      const reversed = coilCurrents(angle, -1);
      expect(reversed).toEqual(forward.map((current) => -current + 0));
    }
  });
});

describe("torqueFactors", () => {
  test("どの角度でも，すべての突起が同じ向きの回転力を受ける", () => {
    for (const angle of SAMPLE_ANGLES) {
      for (const factor of torqueFactors(angle, 1)) {
        expect(factor).toBeGreaterThanOrEqual(0);
      }
      expect(sum(torqueFactors(angle, 1))).toBeGreaterThan(0.5);
    }
  });

  test("電源を逆につなぐと，回転力の向きが逆になる", () => {
    for (const angle of SAMPLE_ANGLES) {
      expect(sum(torqueFactors(angle, -1))).toBeLessThan(-0.5);
    }
  });

  test("突起が永久磁石の真横にあるとき，回転力は最も大きい", () => {
    const [atSide] = torqueFactors(0, 1);
    const [nearMagnet] = torqueFactors(-80 * DEGREE, 1);
    expect(atSide).toBeCloseTo(1);
    expect(nearMagnet).toBeLessThan(0.2);
  });
});
