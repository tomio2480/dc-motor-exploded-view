import type { PartId } from "../motor/parts";

/** ホバー中の部品と，クリックやタップで選択した部品の状態． */
export interface SelectionState {
  readonly hovered: PartId | null;
  readonly selected: PartId | null;
}

export const INITIAL_SELECTION: SelectionState = {
  hovered: null,
  selected: null,
};

export function hover(
  state: SelectionState,
  id: PartId | null,
): SelectionState {
  return { ...state, hovered: id };
}

/** 部品を選択する．選択中の部品をもう一度選ぶと解除する． */
export function toggleSelected(
  state: SelectionState,
  id: PartId,
): SelectionState {
  return { ...state, selected: state.selected === id ? null : id };
}

export function clearSelected(state: SelectionState): SelectionState {
  return { ...state, selected: null };
}

/** 解説を表示する対象の部品．ホバーを選択より優先する． */
export function activePart(state: SelectionState): PartId | null {
  return state.hovered ?? state.selected;
}
