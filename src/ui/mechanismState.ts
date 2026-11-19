import type { Polarity } from "../motor/commutation";

/** 「回るしくみ」の表示の状態． */
export interface MechanismUiState {
  /** 表示している段階の番号．0 から始まる． */
  readonly stepIndex: number;
  /** 回転子の角度（度）．0 以上 360 未満． */
  readonly angleDegrees: number;
  readonly polarity: Polarity;
  readonly isPlaying: boolean;
}

export const INITIAL_MECHANISM_STATE: MechanismUiState = {
  stepIndex: 0,
  angleDegrees: 0,
  polarity: 1,
  isPlaying: false,
};

const FULL_TURN_DEGREES = 360;

function normalizeDegrees(angleDegrees: number): number {
  if (!Number.isFinite(angleDegrees)) {
    throw new RangeError(`角度が有限の数値ではない: ${angleDegrees}`);
  }
  // 負の角度に対する剰余の結果を正へ直し，-0 も 0 へそろえる．
  return (
    (((angleDegrees % FULL_TURN_DEGREES) + FULL_TURN_DEGREES) %
      FULL_TURN_DEGREES) +
    0
  );
}

/** 段階を移る．範囲の外は端の段階へ収め，自動の回転は止める． */
export function goToStep(
  state: MechanismUiState,
  stepIndex: number,
  stepCount: number,
): MechanismUiState {
  if (!Number.isInteger(stepIndex)) {
    throw new RangeError(`段階の番号が整数ではない: ${stepIndex}`);
  }
  return {
    ...state,
    stepIndex: Math.min(Math.max(stepIndex, 0), stepCount - 1),
    isPlaying: false,
  };
}

export function setAngle(
  state: MechanismUiState,
  angleDegrees: number,
): MechanismUiState {
  return { ...state, angleDegrees: normalizeDegrees(angleDegrees) };
}

export function reversePolarity(state: MechanismUiState): MechanismUiState {
  return { ...state, polarity: state.polarity === 1 ? -1 : 1 };
}

/** 一定の速さ（度/秒）で回したときの，経過時間後の角度を返す． */
export function advanceAngle(
  angleDegrees: number,
  speedDegreesPerSecond: number,
  elapsedMs: number,
): number {
  if (!(elapsedMs >= 0)) {
    throw new RangeError(`経過時間が 0 以上の数値ではない: ${elapsedMs}`);
  }
  return normalizeDegrees(
    angleDegrees + (speedDegreesPerSecond * elapsedMs) / 1000,
  );
}

/** 表示とスライダーに使う，整数の度で表した角度を返す． */
export function displayDegrees(angleDegrees: number): number {
  return Math.round(normalizeDegrees(angleDegrees)) % FULL_TURN_DEGREES;
}
