import type { PartId } from "../motor/parts";
import {
  createMotorScene,
  type RenderInfo,
  type ViewMode,
} from "../view/scene";
import { requireElement } from "./dom";
import { startExplodeController } from "./explodeController";
import { createInfoController } from "./infoController";
import { bindKeyboard } from "./keyboardInput";
import { createMarkerLayer } from "./markers";
import { startMechanismController } from "./mechanismController";
import { createLabelButtons, createPartsList } from "./partLists";
import { createPartView } from "./partView";
import { bindCanvasPointer } from "./pointerInput";
import { bindTabs } from "./tabs";

/** 画面の要素と 3D 表示をつなぎ，操作を受け付ける． */
export function startApp(): void {
  const stage = requireElement("stage", HTMLElement);
  const canvas = requireElement("scene", HTMLCanvasElement);
  const labelList = requireElement("labels", HTMLElement);
  const panelElement = requireElement("part-info", HTMLElement);
  const tooltipElement = requireElement("part-tooltip", HTMLElement);
  const partsPanel = requireElement("parts-panel", HTMLDetailsElement);
  const partsSummary = requireElement("parts-summary", HTMLElement);
  const tabList = requireElement("tabs", HTMLElement);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const portrait = window.matchMedia("(orientation: portrait)");
  // style.css で解説欄を 3D の下へ並べる幅と合わせる．
  const narrowLayout = window.matchMedia("(max-width: 640px)");
  const readLineColor = (): string =>
    getComputedStyle(stage).getPropertyValue("--line").trim();

  // WebGL を使えない環境ではここで例外が発生し，以降の操作部品は作らない．
  const scene = createMotorScene(canvas, {
    reducedMotion: reducedMotion.matches,
    portrait: portrait.matches,
    lineColor: readLineColor(),
    onRender: placeOverlays,
  });

  const labelButtons = createLabelButtons(labelList);
  const placeMarkers = createMarkerLayer(
    requireElement("markers", HTMLElement),
  );

  /** 番号ラベルと記号を，3D 上の位置へ合わせる． */
  function placeOverlays(info: RenderInfo): void {
    labelList.style.opacity = String(info.labelOpacity);
    // 見えない番号へフォーカスが移らないよう，表示そのものを切り替える．
    labelList.hidden = info.labelOpacity === 0;
    for (const position of info.labels) {
      const button = labelButtons.get(position.id);
      if (button !== undefined) {
        button.style.transform = `translate(${position.x}px, ${position.y}px)`;
      }
    }
    placeMarkers(info.markers);
  }

  /** 解説を閉じたあと，選んでいた部品の番号へフォーカスを戻す． */
  function closePanel(): void {
    const id = info.selected();
    info.deselect();
    const label = id === null ? undefined : labelButtons.get(id);
    if (label === undefined || labelList.hidden) {
      partsSummary.focus();
    } else {
      label.focus();
    }
  }

  let mode: ViewMode = "parts";

  /**
   * 狭い画面では解説欄が 3D の領域を狭めるため，選んだ部品へ寄って大きく表示する．
   * 広い画面では全体の表示を保つ．
   */
  function applyFocus(selected: PartId | null): void {
    const isFocusing = mode === "parts" && narrowLayout.matches;
    scene.setFocus(isFocusing ? selected : null);
  }

  const info = createInfoController({
    highlight: scene.setHighlight,
    panel: createPartView(panelElement, closePanel),
    tooltip: createPartView(tooltipElement),
    tooltipElement,
    announcer: requireElement("announcer", HTMLElement),
    labelButtons,
    onSelectionChange: applyFocus,
  });

  function bindLabel(id: PartId, button: HTMLButtonElement): void {
    button.addEventListener("click", () => {
      info.toggle(id);
    });
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        info.setHover(id, { x: event.clientX, y: event.clientY });
      }
    });
    button.addEventListener("pointerleave", () => {
      info.setHover(null, null);
    });
  }
  labelButtons.forEach((button, id) => {
    bindLabel(id, button);
  });

  const partsList = requireElement("parts-list", HTMLElement);
  createPartsList(partsList).forEach((button, id) => {
    button.addEventListener("click", () => {
      info.show(id);
      partsPanel.open = false;
      // 閉じた一覧の中へフォーカスが取り残されないよう，見出しへ戻す．
      partsSummary.focus();
    });
  });

  bindCanvasPointer(canvas, scene.pick, info);
  bindKeyboard({
    view: scene,
    onEscape: info.closeAll,
    // スライダー・部品一覧・タブは矢印キーを使うため，視点の操作へ回さない．
    usesKeysItself: (target) =>
      target instanceof HTMLInputElement ||
      (target instanceof Node &&
        (partsPanel.contains(target) || tabList.contains(target))),
  });

  requireElement("reset-view", HTMLButtonElement).addEventListener(
    "click",
    scene.resetView,
  );
  startExplodeController({
    slider: requireElement("explode", HTMLInputElement),
    output: requireElement("explode-output", HTMLOutputElement),
    toggleButton: requireElement("toggle-explode", HTMLButtonElement),
    isMotionReduced: () => reducedMotion.matches,
    onChange: scene.setFactor,
  });

  const mechanism = startMechanismController({
    elements: {
      stepNumber: requireElement("step-number", HTMLElement),
      stepTitle: requireElement("step-title", HTMLElement),
      stepDescription: requireElement("step-description", HTMLElement),
      stepPosition: requireElement("step-position", HTMLElement),
      previousButton: requireElement("step-prev", HTMLButtonElement),
      nextButton: requireElement("step-next", HTMLButtonElement),
      angleSlider: requireElement("rotor-angle", HTMLInputElement),
      angleOutput: requireElement("rotor-angle-output", HTMLOutputElement),
      playButton: requireElement("rotor-play", HTMLButtonElement),
      reverseButton: requireElement("reverse-polarity", HTMLButtonElement),
    },
    isMotionReduced: () => reducedMotion.matches,
    onChange: scene.setMechanism,
  });

  const modes: readonly ViewMode[] = ["parts", "mechanism"];
  const tabs = [
    requireElement("tab-parts", HTMLElement),
    requireElement("tab-mechanism", HTMLElement),
  ];
  const partsControls = requireElement("controls-parts", HTMLElement);
  const mechanismControls = requireElement("controls-mechanism", HTMLElement);
  const stepInfo = requireElement("step-info", HTMLElement);

  /** 表示の種類を切り替え，それぞれに専用の操作と説明だけを見せる． */
  function showMode(index: number): void {
    mode = modes[index] ?? "parts";
    const isMechanism = mode === "mechanism";
    // 部品の解説は展開図の表示に属するため，切り替えるときに閉じる．
    info.closeAll();
    partsPanel.open = false;
    partsPanel.hidden = isMechanism;
    partsControls.hidden = isMechanism;
    mechanismControls.hidden = !isMechanism;
    stepInfo.hidden = !isMechanism;
    stage.setAttribute("aria-labelledby", tabs[index]?.id ?? "");
    stage.dataset.mode = mode;
    scene.setMode(mode);
    mechanism.setActive(isMechanism);
  }
  bindTabs(tabs, showMode);

  new ResizeObserver(scene.resize).observe(stage);
  portrait.addEventListener("change", () => {
    scene.setPortrait(portrait.matches);
  });
  narrowLayout.addEventListener("change", () => {
    applyFocus(info.selected());
  });
  darkScheme.addEventListener("change", () => {
    scene.setLineColor(readLineColor());
  });

  stage.dataset.ready = "true";
}
