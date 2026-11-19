import { getPart, type PartId } from "../motor/parts";
import type { PartView } from "./partView";
import {
  activePart,
  clearSelected,
  hover,
  INITIAL_SELECTION,
  type SelectionState,
  toggleSelected,
} from "./selection";
import { type Point, placeTooltip } from "./tooltip";

const TOOLTIP_GAP_PX = 16;

export interface InfoControllerOptions {
  /** 注目中の部品を 3D 上で強調する． */
  readonly highlight: (id: PartId | null) => void;
  /** 選択した部品を固定して表示する欄． */
  readonly panel: PartView;
  /** マウスを重ねた部品をポインターの近くへ表示する欄． */
  readonly tooltip: PartView;
  readonly tooltipElement: HTMLElement;
  /** 選択の変化を支援技術へ伝えるライブリージョン． */
  readonly announcer: HTMLElement;
  readonly labelButtons: ReadonlyMap<PartId, HTMLElement>;
  /** 選択している部品が変わるたびに呼ぶ． */
  readonly onSelectionChange: (id: PartId | null) => void;
}

/** 部品の選択とホバーの状態を持ち，解説の表示へ反映する． */
export interface InfoController {
  /** 現在選択している部品． */
  selected(): PartId | null;
  /** 部品を選択する．選択中の部品をもう一度選ぶと解除する． */
  toggle(id: PartId): void;
  /** 部品を選択する．すでに選択中でも解除しない． */
  show(id: PartId): void;
  deselect(): void;
  /** 選択による解説とホバーによる吹き出しの両方を閉じる． */
  closeAll(): void;
  setHover(id: PartId | null, pointer: Point | null): void;
}

export function createInfoController(
  options: InfoControllerOptions,
): InfoController {
  const { highlight, panel, tooltip, tooltipElement, announcer, labelButtons } =
    options;
  let selection: SelectionState = INITIAL_SELECTION;
  let pointer: Point | null = null;

  function renderTooltip(): void {
    const hovered = selection.hovered;
    // 固定して表示している部品と同じ内容は，吹き出しで繰り返さない．
    if (
      hovered === null ||
      hovered === selection.selected ||
      pointer === null
    ) {
      tooltip.hide();
      return;
    }
    tooltip.show(getPart(hovered));
    const size = tooltipElement.getBoundingClientRect();
    const placement = placeTooltip({
      pointer,
      size: { width: size.width, height: size.height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      gap: TOOLTIP_GAP_PX,
    });
    tooltipElement.style.left = `${placement.left}px`;
    tooltipElement.style.top = `${placement.top}px`;
  }

  function renderPanel(): void {
    if (selection.selected === null) {
      panel.hide();
      return;
    }
    panel.show(getPart(selection.selected));
  }

  function render(): void {
    const active = activePart(selection);
    highlight(active);
    for (const [id, button] of labelButtons) {
      button.classList.toggle("is-active", id === active);
      button.setAttribute("aria-pressed", String(id === selection.selected));
    }
    renderPanel();
    renderTooltip();
  }

  function announce(): void {
    if (selection.selected === null) {
      announcer.textContent = "解説を閉じました．";
      return;
    }
    const part = getPart(selection.selected);
    announcer.textContent = `${part.name}．${part.role}．${part.description}`;
  }

  /** 状態を入れ替えて表示へ反映する．選択が変わったときだけ読み上げる． */
  function update(next: SelectionState): void {
    const hasSelectionChanged = next.selected !== selection.selected;
    selection = next;
    if (hasSelectionChanged) {
      announce();
    }
    render();
    if (hasSelectionChanged) {
      // 解説欄の表示を切り替えたあとで，領域の大きさに合った視点を決めさせる．
      options.onSelectionChange(selection.selected);
    }
  }

  render();

  return {
    selected: () => selection.selected,
    toggle(id) {
      update(toggleSelected(selection, id));
    },
    show(id) {
      if (selection.selected !== id) {
        update(toggleSelected(selection, id));
      }
    },
    deselect() {
      update(clearSelected(selection));
    },
    closeAll() {
      pointer = null;
      update(INITIAL_SELECTION);
    },
    setHover(id, position) {
      pointer = position;
      update(hover(selection, id));
    },
  };
}
