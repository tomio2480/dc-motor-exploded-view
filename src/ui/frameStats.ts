import type { QualityOptions } from "../view/quality";
import type { FrameStats } from "../view/scene";

/** 表示を書き換える間隔（ミリ秒）．表示の更新そのものが負荷にならないよう間引く． */
const UPDATE_INTERVAL_MS = 250;
const MS_PER_SECOND = 1000;

function formatStats(frame: FrameStats, quality: QualityOptions): string {
  const speed =
    frame.intervalMs === null
      ? "計測待ち"
      : `${frame.intervalMs.toFixed(1)} ms（${Math.round(MS_PER_SECOND / frame.intervalMs)} fps）`;
  return [
    speed,
    `${frame.width}×${frame.height} px`,
    frame.antialias ? "AA あり" : "AA なし",
    quality.usesBackdropBlur ? "ぼかしあり" : "ぼかしなし",
  ].join("・");
}

/**
 * 描画の速さと設定を画面へ表示する処理を返す．
 * 実機で重さの原因を切り分けるための表示で，URL に fps=on を付けたときだけ使う．
 */
export function createFrameStatsView(
  element: HTMLElement,
  quality: QualityOptions,
): (frame: FrameStats) => void {
  let lastUpdate = Number.NEGATIVE_INFINITY;
  element.hidden = false;

  return (frame) => {
    const now = performance.now();
    if (now - lastUpdate < UPDATE_INTERVAL_MS) {
      return;
    }
    lastUpdate = now;
    element.textContent = formatStats(frame, quality);
  };
}
