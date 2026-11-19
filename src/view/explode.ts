import type { Vec3 } from "../vec3";

/** 番号ラベルが現れ始める展開度． */
export const LABEL_FADE_START = 0.45;
/** 番号ラベルが完全に表示される展開度． */
export const LABEL_FADE_END = 0.75;

/** 展開度を 0（組立）から 1（展開）の範囲へ収める． */
export function clampFactor(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`展開度が有限の数値ではない: ${value}`);
  }
  return Math.min(1, Math.max(0, value));
}

/** 展開度に応じた，組立位置からの移動量を返す． */
export function explodedOffset(offset: Vec3, factor: number): Vec3 {
  const ratio = clampFactor(factor);
  // 負の成分に 0 を掛けた結果の -0 を 0 へそろえる．
  return [offset[0] * ratio + 0, offset[1] * ratio + 0, offset[2] * ratio + 0];
}

/** 部品が重なる組立状態では番号ラベルを隠すための不透明度を返す． */
export function labelOpacity(factor: number): number {
  const ratio = clampFactor(factor);
  const progress =
    (ratio - LABEL_FADE_START) / (LABEL_FADE_END - LABEL_FADE_START);
  return Math.min(1, Math.max(0, progress));
}

/** 現在値を目標値へ，最大変化量を超えない範囲で近づける． */
export function approach(
  current: number,
  target: number,
  maxDelta: number,
): number {
  if (!(maxDelta >= 0)) {
    throw new RangeError(`最大変化量が 0 以上の数値ではない: ${maxDelta}`);
  }
  const remaining = target - current;
  if (Math.abs(remaining) <= maxDelta) {
    return target;
  }
  return current + Math.sign(remaining) * maxDelta;
}
