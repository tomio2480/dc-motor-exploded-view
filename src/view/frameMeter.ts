/** 連続して描画したフレームの間隔から，描画の速さを求める． */
export interface FrameMeter {
  /**
   * フレームを描画した時刻（ミリ秒）を記録する．
   * 直前のフレームでも描画していて，フレームが途切れていなければ，followsRender に true を渡す．
   * ページを隠していた間など，フレームそのものが止まっていた場合は false とする．
   */
  record(timeMs: number, followsRender?: boolean): void;
  /** 直近のフレーム間隔の中央値（ミリ秒）．連続した描画がなければ null． */
  typicalIntervalMs(): number | null;
}

/**
 * 描画の速さを測る計器を作る．
 * windowSize は値を求めるのに使う間隔の数である．
 * maxGapMs より長い間隔は，描画を止めていた時間とみなし，そこから測り直す．
 * ただし，続けて描画した間隔は，止めていた時間を含まないため，長くても測る．
 * 最初の描画の直後の間隔は，1 回きりの準備の処理を含みうるため，続けて描画していても上限を当てる．
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
  /** 最初の描画を終え，その直後の間隔も過ぎたか． */
  let isPastFirstRender = false;

  return {
    record(timeMs, followsRender = false) {
      const interval = lastTime === null ? null : timeMs - lastTime;
      // 最初の描画は，シェーダーの準備などの 1 回きりの処理を含みうる．
      // その直後の間隔を数えると，遅い環境では最初の値が極端に遅く出る．
      const isContinuous = followsRender && isPastFirstRender;
      isPastFirstRender = lastTime !== null;
      lastTime = timeMs;
      if (interval === null) {
        return;
      }
      if (!isContinuous && interval > maxGapMs) {
        // 描画を止めていた時間や準備の処理を含む間隔を混ぜないよう，測り直す．
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
