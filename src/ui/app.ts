import { getPart, isPartId, PARTS, type PartId } from "../motor/parts";
import { approach, clampFactor } from "../view/explode";
import {
  createMotorScene,
  type LabelPosition,
  type MotorScene,
} from "../view/scene";
import {
  activePart,
  clearSelected,
  hover,
  INITIAL_SELECTION,
  type SelectionState,
  toggleSelected,
} from "./selection";
import { type Point, placeTooltip } from "./tooltip";

const SLIDER_MAX = 100;
/** 組立と展開を切り替えるアニメーションの長さ（ミリ秒）． */
const EXPLODE_DURATION_MS = 1100;
/** 読み込み後に展開を始めるまでの待ち時間（ミリ秒）． */
const INTRO_DELAY_MS = 500;
/** これより長く動かしたポインター操作は，視点のドラッグとして扱う（px）． */
const DRAG_THRESHOLD_PX = 6;
const TOOLTIP_GAP_PX = 16;
const KEY_ORBIT_STEP = Math.PI / 18;
const KEY_ZOOM_STEP = 0.85;

type ElementConstructor<T extends Element> = new () => T;

function requireElement<T extends Element>(
  id: string,
  type: ElementConstructor<T>,
): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`必要な要素が見つからない: #${id}`);
  }
  return element;
}

function readPartId(element: HTMLElement): PartId {
  const id = element.dataset.partId;
  if (!isPartId(id)) {
    throw new Error(`部品 ID を持たない要素である: ${element.outerHTML}`);
  }
  return id;
}

function createLabelButtons(container: HTMLElement): Map<PartId, HTMLElement> {
  const buttons = new Map<PartId, HTMLElement>();
  for (const part of PARTS) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "label";
    button.dataset.partId = part.id;
    button.textContent = String(part.number);
    button.setAttribute("aria-label", `${part.number} ${part.name}`);
    button.setAttribute("aria-pressed", "false");
    item.append(button);
    container.append(item);
    buttons.set(part.id, button);
  }
  return buttons;
}

function createPartsList(container: HTMLElement): void {
  for (const part of PARTS) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "parts-list__item";
    button.dataset.partId = part.id;

    const number = document.createElement("span");
    number.className = "parts-list__number";
    number.textContent = String(part.number);
    const name = document.createElement("span");
    name.className = "parts-list__name";
    name.textContent = part.name;
    const role = document.createElement("span");
    role.className = "parts-list__role";
    role.textContent = part.role;

    button.append(number, name, role);
    item.append(button);
    container.append(item);
  }
}

/** 画面の要素と 3D 表示をつなぎ，操作を受け付ける． */
export function startApp(): void {
  const stage = requireElement("stage", HTMLElement);
  const canvas = requireElement("scene", HTMLCanvasElement);
  const labelList = requireElement("labels", HTMLElement);
  const info = requireElement("part-info", HTMLElement);
  const infoNumber = requireElement("part-info-number", HTMLElement);
  const infoName = requireElement("part-info-name", HTMLElement);
  const infoKana = requireElement("part-info-kana", HTMLElement);
  const infoRole = requireElement("part-info-role", HTMLElement);
  const infoDescription = requireElement("part-info-description", HTMLElement);
  const infoClose = requireElement("part-info-close", HTMLButtonElement);
  const announcer = requireElement("announcer", HTMLElement);
  const slider = requireElement("explode", HTMLInputElement);
  const sliderOutput = requireElement("explode-output", HTMLOutputElement);
  const toggleButton = requireElement("toggle-explode", HTMLButtonElement);
  const resetButton = requireElement("reset-view", HTMLButtonElement);
  const partsPanel = requireElement("parts-panel", HTMLDetailsElement);
  const partsList = requireElement("parts-list", HTMLElement);

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const darkScheme = window.matchMedia("(prefers-color-scheme: dark)");
  const readLineColor = (): string =>
    getComputedStyle(stage).getPropertyValue("--line").trim();

  const labelButtons = createLabelButtons(labelList);
  createPartsList(partsList);

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

  const scene: MotorScene = createMotorScene(canvas, {
    reducedMotion: reducedMotion.matches,
    lineColor: readLineColor(),
    onRender: placeLabels,
  });

  let selection: SelectionState = INITIAL_SELECTION;
  /** マウスで部品を指しているときの，吹き出しの基準位置． */
  let pointer: Point | null = null;
  let factor = reducedMotion.matches ? 1 : 0;
  let targetFactor = factor;
  let lastFrameTime: number | null = null;

  function renderInfo(): void {
    const id = activePart(selection);
    scene.setHighlight(id);
    for (const [partId, button] of labelButtons) {
      button.classList.toggle("is-active", partId === id);
      button.setAttribute(
        "aria-pressed",
        String(partId === selection.selected),
      );
    }
    if (id === null) {
      info.hidden = true;
      return;
    }

    const part = getPart(id);
    infoNumber.textContent = String(part.number);
    infoName.textContent = part.name;
    infoKana.textContent = part.kana;
    infoRole.textContent = part.role;
    infoDescription.textContent = part.description;
    info.hidden = false;

    const isFloating = selection.hovered !== null && pointer !== null;
    info.dataset.mode = isFloating ? "floating" : "docked";
    if (!isFloating || pointer === null) {
      info.style.removeProperty("left");
      info.style.removeProperty("top");
      return;
    }
    const size = info.getBoundingClientRect();
    const placement = placeTooltip({
      pointer,
      size: { width: size.width, height: size.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      gap: TOOLTIP_GAP_PX,
    });
    info.style.left = `${placement.left}px`;
    info.style.top = `${placement.top}px`;
  }

  function announceSelection(): void {
    if (selection.selected === null) {
      announcer.textContent = "解説を閉じました．";
      return;
    }
    const part = getPart(selection.selected);
    announcer.textContent = `${part.name}．${part.role}．${part.description}`;
  }

  function select(id: PartId): void {
    selection = toggleSelected(selection, id);
    announceSelection();
    renderInfo();
  }

  function deselect(): void {
    if (selection.selected === null) {
      return;
    }
    selection = clearSelected(selection);
    announceSelection();
    renderInfo();
  }

  /** Escape キーで，選択による解説とホバーによる解説の両方を閉じる． */
  function closeInfo(): void {
    const hadSelection = selection.selected !== null;
    selection = INITIAL_SELECTION;
    pointer = null;
    if (hadSelection) {
      announceSelection();
    }
    renderInfo();
  }

  function setHover(id: PartId | null, position: Point | null): void {
    pointer = position;
    selection = hover(selection, id);
    renderInfo();
  }

  function renderFactor(): void {
    const percent = Math.round(factor * SLIDER_MAX);
    slider.value = String(percent);
    slider.setAttribute("aria-valuetext", `${percent} パーセント`);
    sliderOutput.textContent = `${percent}%`;
    toggleButton.textContent = targetFactor >= 0.5 ? "組み立てる" : "展開する";
    scene.setFactor(factor);
  }

  function animateFactor(time: number): void {
    const elapsed = lastFrameTime === null ? 0 : time - lastFrameTime;
    lastFrameTime = time;
    factor = approach(factor, targetFactor, elapsed / EXPLODE_DURATION_MS);
    renderFactor();
    if (factor === targetFactor) {
      lastFrameTime = null;
      return;
    }
    requestAnimationFrame(animateFactor);
  }

  function moveFactorTo(target: number): void {
    targetFactor = clampFactor(target);
    if (reducedMotion.matches) {
      factor = targetFactor;
      renderFactor();
      return;
    }
    if (lastFrameTime === null) {
      requestAnimationFrame(animateFactor);
    }
    renderFactor();
  }

  slider.addEventListener("input", () => {
    factor = clampFactor(slider.valueAsNumber / SLIDER_MAX);
    targetFactor = factor;
    renderFactor();
  });

  toggleButton.addEventListener("click", () => {
    moveFactorTo(targetFactor >= 0.5 ? 0 : 1);
  });

  resetButton.addEventListener("click", () => {
    scene.resetView();
  });

  for (const button of labelButtons.values()) {
    const id = readPartId(button);
    button.addEventListener("click", () => {
      select(id);
    });
    button.addEventListener("pointerenter", (event) => {
      if (event.pointerType === "mouse") {
        setHover(id, { x: event.clientX, y: event.clientY });
      }
    });
    button.addEventListener("pointerleave", () => {
      setHover(null, null);
    });
  }

  partsList.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) {
      return;
    }
    const button = event.target.closest("button");
    if (button === null) {
      return;
    }
    const id = readPartId(button);
    if (selection.selected !== id) {
      select(id);
    }
    partsPanel.open = false;
  });

  infoClose.addEventListener("click", deselect);

  let pressStart: Point | null = null;
  canvas.addEventListener("pointerdown", (event) => {
    pressStart = { x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener("pointerup", (event) => {
    if (pressStart === null) {
      return;
    }
    const moved = Math.hypot(
      event.clientX - pressStart.x,
      event.clientY - pressStart.y,
    );
    pressStart = null;
    if (moved > DRAG_THRESHOLD_PX) {
      return;
    }
    const id = scene.pick(event.clientX, event.clientY);
    if (id === null) {
      deselect();
    } else {
      select(id);
    }
  });
  canvas.addEventListener("pointercancel", () => {
    pressStart = null;
  });
  canvas.addEventListener("pointermove", (event) => {
    // 指での操作は視点の回転に使うため，ホバーはマウスのときだけ扱う．
    if (event.pointerType !== "mouse" || event.buttons !== 0) {
      return;
    }
    const position = { x: event.clientX, y: event.clientY };
    setHover(scene.pick(position.x, position.y), position);
  });
  canvas.addEventListener("pointerleave", () => {
    setHover(null, null);
  });

  const viewKeyActions: Record<string, () => void> = {
    ArrowLeft: () => scene.orbitBy(-KEY_ORBIT_STEP, 0),
    ArrowRight: () => scene.orbitBy(KEY_ORBIT_STEP, 0),
    ArrowUp: () => scene.orbitBy(0, -KEY_ORBIT_STEP),
    ArrowDown: () => scene.orbitBy(0, KEY_ORBIT_STEP),
    "+": () => scene.zoomBy(KEY_ZOOM_STEP),
    "-": () => scene.zoomBy(1 / KEY_ZOOM_STEP),
  };

  /** スライダーや部品一覧がキーを使う場面では，視点の操作へ回さない． */
  function usesKeysItself(target: EventTarget | null): boolean {
    return (
      target instanceof HTMLInputElement ||
      (target instanceof Node && partsPanel.contains(target))
    );
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeInfo();
      return;
    }
    const action = viewKeyActions[event.key];
    if (
      action === undefined ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      usesKeysItself(event.target)
    ) {
      return;
    }
    event.preventDefault();
    action();
  });

  new ResizeObserver(() => {
    scene.resize();
  }).observe(stage);

  darkScheme.addEventListener("change", () => {
    scene.setLineColor(readLineColor());
  });

  renderFactor();
  renderInfo();
  stage.dataset.ready = "true";
  if (!reducedMotion.matches) {
    window.setTimeout(() => {
      moveFactorTo(1);
    }, INTRO_DELAY_MS);
  }
}
