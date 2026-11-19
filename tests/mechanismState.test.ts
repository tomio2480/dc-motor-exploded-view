import { describe, expect, test } from "vitest";
import {
  advanceAngle,
  displayDegrees,
  goToStep,
  INITIAL_MECHANISM_STATE,
  reversePolarity,
  setAngle,
} from "../src/ui/mechanismState";

const STEP_COUNT = 6;

describe("goToStep", () => {
  test("指定した段階へ移る", () => {
    expect(goToStep(INITIAL_MECHANISM_STATE, 3, STEP_COUNT).stepIndex).toBe(3);
  });

  test("最初より前へは移らない", () => {
    expect(goToStep(INITIAL_MECHANISM_STATE, -1, STEP_COUNT).stepIndex).toBe(0);
  });

  test("最後より後へは移らない", () => {
    expect(goToStep(INITIAL_MECHANISM_STATE, 9, STEP_COUNT).stepIndex).toBe(5);
  });

  test("段階を移ると，自動の回転を止める", () => {
    const playing = { ...INITIAL_MECHANISM_STATE, isPlaying: true };
    expect(goToStep(playing, 2, STEP_COUNT).isPlaying).toBe(false);
  });

  test("段階を移っても，角度と電源の向きは保つ", () => {
    const state = {
      ...INITIAL_MECHANISM_STATE,
      angleDegrees: 75,
      polarity: -1 as const,
    };
    expect(goToStep(state, 2, STEP_COUNT)).toMatchObject({
      angleDegrees: 75,
      polarity: -1,
    });
  });

  test("整数でない段階は拒否する", () => {
    expect(() => goToStep(INITIAL_MECHANISM_STATE, 1.5, STEP_COUNT)).toThrow(
      RangeError,
    );
  });
});

describe("setAngle", () => {
  test("角度を 0 以上 360 未満へそろえる", () => {
    expect(setAngle(INITIAL_MECHANISM_STATE, 370).angleDegrees).toBeCloseTo(10);
    expect(setAngle(INITIAL_MECHANISM_STATE, -30).angleDegrees).toBeCloseTo(
      330,
    );
    expect(setAngle(INITIAL_MECHANISM_STATE, 360).angleDegrees).toBeCloseTo(0);
  });

  test("有限でない角度は拒否する", () => {
    expect(() => setAngle(INITIAL_MECHANISM_STATE, Number.NaN)).toThrow(
      RangeError,
    );
  });
});

describe("reversePolarity", () => {
  test("電源の向きを入れ替える", () => {
    const reversed = reversePolarity(INITIAL_MECHANISM_STATE);
    expect(reversed.polarity).toBe(-1);
    expect(reversePolarity(reversed).polarity).toBe(1);
  });
});

describe("advanceAngle", () => {
  test("速さと経過時間の積だけ角度が進む", () => {
    expect(advanceAngle(10, 90, 500)).toBeCloseTo(55);
  });

  test("負の速さでは逆へ進む", () => {
    expect(advanceAngle(10, -90, 500)).toBeCloseTo(325);
  });

  test("1 回転を超えたら 0 へ戻る", () => {
    expect(advanceAngle(350, 90, 1000)).toBeCloseTo(80);
  });

  test("経過時間が負の場合は拒否する", () => {
    expect(() => advanceAngle(0, 90, -1)).toThrow(RangeError);
  });
});

describe("displayDegrees", () => {
  test("角度を整数の度へ丸める", () => {
    expect(displayDegrees(40.4)).toBe(40);
    expect(displayDegrees(40.6)).toBe(41);
  });

  test("360 度へ丸まる角度は 0 度として表す", () => {
    expect(displayDegrees(359.6)).toBe(0);
  });
});
