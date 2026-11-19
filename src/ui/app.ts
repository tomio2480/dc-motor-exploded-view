import type { PartId } from "../motor/parts";
import { createMotorScene, type LabelPosition } from "../view/scene";
import { requireElement } from "./dom";
import { startExplodeController } from "./explodeController";
import { createInfoController } from "./infoController";
import { bindKeyboard } from "./keyboardInput";
import { createLabelButtons, createPartsList } from "./partLists";
import { createPartView } from "./partView";
import { bindCanvasPointer } from "./pointerInput";

/** 画面の要素と 3D 表示をつなぎ，操作を受け付ける． */
export function startApp(): void {
  const stage = requireElement("stage", HTMLElement);
  const canvas = requireElement("scene", HTMLCanvasElement);
  const labelList = requireElement("labels", HTMLElement);
  const panelElement = requireElement("part-info", HTMLElement);
  const tooltipElement = requireElement("part-tooltip", HTMLElement);
  const partsPanel = requireElement("parts-panel", HTMLDetailsElement);
  const partsSummary = requireElement("parts-summary", HTMLElement);

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
    onRender: placeLabels,
  });

  const labelButtons = createLabelButtons(labelList);

  function placeLabels(
    positions: readonly LabelPosition[],
    opacity: number,
  ): void {
    labelList.style.opacity = String(opacity);
    // 見えない番号へフォーカスが移らないよう，表示そのものを切り替える．
    labelList.hidden = opacity === 0;
    for (const position of positions) {
      const button = labelButtons.get(position.id);
      if (button !== undefined) {
        button.style.transform = `translate(${position.x}px, ${position.y}px)`;
      }
    }
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

  /**
   * 狭い画面では解説欄が 3D の領域を狭めるため，選んだ部品へ寄って大きく表示する．
   * 広い画面では全体の表示を保つ．
   */
  function applyFocus(selected: PartId | null): void {
    scene.setFocus(narrowLayout.matches ? selected : null);
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
    // スライダーと部品一覧は矢印キーを使うため，視点の操作へ回さない．
    usesKeysItself: (target) =>
      target instanceof HTMLInputElement ||
      (target instanceof Node && partsPanel.contains(target)),
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
