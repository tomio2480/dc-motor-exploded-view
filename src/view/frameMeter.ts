/** 連続して描画したフレームの間隔から，描画の速さを求める． */
export interface FrameMeter {
  /** フレームを描画した時刻（ミリ秒）を記録する． */
  record(timeMs: number): void;
  /** 直近のフレーム間隔の中央値（ミリ秒）．連続した描画がなければ null． */
  typicalIntervalMs(): number | null;
}

/**
 * 描画の速さを測る計器を作る．
 * windowSize は値を求めるのに使う間隔の数である．
 * maxGapMs より長い間隔は，描画を止めていた時間とみなし，そこから測り直す．
 */
export function createFrameMeter(
  windowSize: number,
  maxGapMs: number,
): FrameMeter {
  if (!Number.isInteger(windowSize) || windowSize < 1) {
    throw new RangeError(`使う間隔の数が 1 以上の整数ではない: ${windowSize}`);
  }
  const intervals: number[] = [];
  let lastTime: number | null = null;

  return {
    record(timeMs) {
      const interval = lastTime === null ? null : timeMs - lastTime;
      lastTime = timeMs;
      if (interval === null) {
        return;
      }
      if (interval > maxGapMs) {
        // 描画を止めていた前後の間隔を混ぜないよう，測り直す．
        intervals.length = 0;
        return;
      }
      intervals.push(interval);
      if (intervals.length > windowSize) {
        intervals.shift();
      }
    },
    typicalIntervalMs() {
      if (intervals.length === 0) {
        return null;
      }
      // 操作の合間の短い停止に引きずられないよう，平均でなく中央値を使う．
      const sorted = [...intervals].sort((a, b) => a - b);
      const middle = Math.floor(sorted.length / 2);
      const upper = sorted[middle] ?? 0;
      if (sorted.length % 2 === 1) {
        return upper;
      }
      return ((sorted[middle - 1] ?? upper) + upper) / 2;
    },
  };
}
