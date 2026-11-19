import { MECHANISM_STEPS, type MechanismStep } from "../motor/mechanismSteps";
import type { MechanismView } from "../view/mechanismOverlay";
import {
  advanceAngle,
  goToStep,
  INITIAL_MECHANISM_STATE,
  type MechanismUiState,
  reversePolarity,
  setAngle,
} from "./mechanismState";

/** 回転を見せない段階で利用者が回したときの速さ（度/秒）． */
const MANUAL_ROTATION_SPEED = 60;
const DEGREE = Math.PI / 180;

export interface MechanismElements {
  readonly stepNumber: HTMLElement;
  readonly stepTitle: HTMLElement;
  readonly stepDescription: HTMLElement;
  readonly stepPosition: HTMLElement;
  readonly previousButton: HTMLButtonElement;
  readonly nextButton: HTMLButtonElement;
  readonly angleSlider: HTMLInputElement;
  readonly angleOutput: HTMLOutputElement;
  readonly playButton: HTMLButtonElement;
  readonly reverseButton: HTMLButtonElement;
}

export interface MechanismControllerOptions {
  readonly elements: MechanismElements;
  /** アニメーションを省くかどうかを，操作のたびに問い合わせる． */
  readonly isMotionReduced: () => boolean;
  /** 3D へ示す内容が変わるたびに呼ぶ． */
  readonly onChange: (view: MechanismView) => void;
}

export interface MechanismController {
  /** 表示中かどうかを切り替える．表示をやめるときは回転を止める． */
  setActive(isActive: boolean): void;
}

function currentStep(state: MechanismUiState): MechanismStep {
  const step = MECHANISM_STEPS[state.stepIndex];
  if (step === undefined) {
    throw new Error(`段階の定義がない: ${state.stepIndex}`);
  }
  return step;
}

function toView(state: MechanismUiState): MechanismView {
  const step = currentStep(state);
  return {
    rotorAngle: state.angleDegrees * DEGREE,
    polarity: state.polarity,
    currentReach: step.currentReach,
    showsPoles: step.showsPoles,
    showsForces: step.showsForces,
  };
}

/** 段階の説明と回転子の操作を受け付け，3D の表示へ反映する． */
export function startMechanismController(
  options: MechanismControllerOptions,
): MechanismController {
  const { elements, isMotionReduced, onChange } = options;
  let state = INITIAL_MECHANISM_STATE;
  let isActive = false;
  let lastFrameTime: number | null = null;

  function renderStep(): void {
    const step = currentStep(state);
    elements.stepNumber.textContent = String(state.stepIndex + 1);
    elements.stepTitle.textContent = step.title;
    elements.stepDescription.textContent = step.description;
    elements.stepPosition.textContent = `${state.stepIndex + 1} / ${MECHANISM_STEPS.length}`;
    elements.previousButton.disabled = state.stepIndex === 0;
    elements.nextButton.disabled =
      state.stepIndex === MECHANISM_STEPS.length - 1;
  }

  function renderRotor(): void {
    const degrees = Math.round(state.angleDegrees);
    elements.angleSlider.value = String(degrees);
    elements.angleSlider.setAttribute("aria-valuetext", `${degrees} 度`);
    elements.angleOutput.textContent = `${degrees}°`;
    elements.playButton.textContent = state.isPlaying ? "止める" : "回す";
    elements.reverseButton.setAttribute(
      "aria-pressed",
      String(state.polarity === -1),
    );
    onChange(toView(state));
  }

  function rotate(time: number): void {
    if (!state.isPlaying || !isActive) {
      lastFrameTime = null;
      return;
    }
    const elapsedMs = lastFrameTime === null ? 0 : time - lastFrameTime;
    lastFrameTime = time;
    const speed = currentStep(state).rotationSpeed || MANUAL_ROTATION_SPEED;
    // 回転力の向きは電源の向きで決まるため，逆につなぐと逆へ回す．
    state = setAngle(
      state,
      advanceAngle(state.angleDegrees, speed * state.polarity, elapsedMs),
    );
    renderRotor();
    requestAnimationFrame(rotate);
  }

  function setPlaying(isPlaying: boolean): void {
    const wasPlaying = state.isPlaying;
    state = { ...state, isPlaying };
    renderRotor();
    if (isPlaying && !wasPlaying) {
      requestAnimationFrame(rotate);
    }
  }

  function showStep(stepIndex: number): void {
    state = goToStep(state, stepIndex, MECHANISM_STEPS.length);
    renderStep();
    // 回転を見せる段階では自動で回す．動きを減らす設定では，操作を待つ．
    setPlaying(currentStep(state).rotationSpeed > 0 && !isMotionReduced());
  }

  elements.previousButton.addEventListener("click", () => {
    showStep(state.stepIndex - 1);
  });
  elements.nextButton.addEventListener("click", () => {
    showStep(state.stepIndex + 1);
  });
  elements.angleSlider.addEventListener("input", () => {
    // 利用者が角度を決めている間は，自動の回転を止める．
    state = {
      ...setAngle(state, elements.angleSlider.valueAsNumber),
      isPlaying: false,
    };
    renderRotor();
  });
  elements.playButton.addEventListener("click", () => {
    setPlaying(!state.isPlaying);
  });
  elements.reverseButton.addEventListener("click", () => {
    state = reversePolarity(state);
    renderRotor();
  });

  renderStep();
  renderRotor();

  return {
    setActive(next) {
      isActive = next;
      if (isActive) {
        showStep(state.stepIndex);
      } else {
        setPlaying(false);
      }
    },
  };
}
