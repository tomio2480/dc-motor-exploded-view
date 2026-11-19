import { approach, clampFactor } from "../view/explode";

const SLIDER_MAX = 100;
/** 組立と展開を切り替えるアニメーションの長さ（ミリ秒）． */
const EXPLODE_DURATION_MS = 1100;
/** 読み込み後に展開を始めるまでの待ち時間（ミリ秒）． */
const INTRO_DELAY_MS = 500;
/** 展開度がこの値以上なら，ボタンは次の操作として「組み立てる」を示す． */
const EXPLODED_THRESHOLD = 0.5;

export interface ExplodeControllerOptions {
  readonly slider: HTMLInputElement;
  readonly output: HTMLOutputElement;
  readonly toggleButton: HTMLButtonElement;
  /** アニメーションを省くかどうかを，操作のたびに問い合わせる． */
  readonly isMotionReduced: () => boolean;
  /** 展開度が変わるたびに呼ぶ． */
  readonly onChange: (factor: number) => void;
}

/**
 * スライダーとボタンから展開度を操作する．
 * 読み込み直後は組立状態から展開状態へ動かし，展開図であることを示す．
 */
export function startExplodeController(
  options: ExplodeControllerOptions,
): void {
  const { slider, output, toggleButton, isMotionReduced, onChange } = options;
  let factor = isMotionReduced() ? 1 : 0;
  let target = factor;
  let lastFrameTime: number | null = null;

  function render(): void {
    const percent = Math.round(factor * SLIDER_MAX);
    slider.value = String(percent);
    slider.setAttribute("aria-valuetext", `${percent} パーセント`);
    output.textContent = `${percent}%`;
    toggleButton.textContent =
      target >= EXPLODED_THRESHOLD ? "組み立てる" : "展開する";
    onChange(factor);
  }

  function animate(time: number): void {
    const elapsed = lastFrameTime === null ? 0 : time - lastFrameTime;
    lastFrameTime = time;
    factor = approach(factor, target, elapsed / EXPLODE_DURATION_MS);
    render();
    if (factor === target) {
      lastFrameTime = null;
      return;
    }
    requestAnimationFrame(animate);
  }

  function moveTo(next: number): void {
    target = clampFactor(next);
    if (isMotionReduced()) {
      factor = target;
      render();
      return;
    }
    render();
    if (lastFrameTime === null) {
      requestAnimationFrame(animate);
    }
  }

  slider.addEventListener("input", () => {
    factor = clampFactor(slider.valueAsNumber / SLIDER_MAX);
    target = factor;
    render();
  });

  toggleButton.addEventListener("click", () => {
    moveTo(target >= EXPLODED_THRESHOLD ? 0 : 1);
  });

  render();
  if (factor < 1) {
    window.setTimeout(() => {
      moveTo(1);
    }, INTRO_DELAY_MS);
  }
}
