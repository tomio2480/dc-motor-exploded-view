/**
 * 目標へ指数的に近づけるときの，1 回の更新で進む割合を返す．
 * 経過時間が時定数と等しいとき，残りの約 63% を進む．
 */
export function smoothingFactor(
  elapsedMs: number,
  timeConstantMs: number,
): number {
  if (!(elapsedMs >= 0)) {
    throw new RangeError(`経過時間が 0 以上の数値ではない: ${elapsedMs}`);
  }
  if (!(timeConstantMs > 0)) {
    throw new RangeError(`時定数が正の数値ではない: ${timeConstantMs}`);
  }
  return 1 - Math.exp(-elapsedMs / timeConstantMs);
}
