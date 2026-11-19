import { describe, expect, test } from "vitest";
import {
  activePart,
  clearSelected,
  hover,
  INITIAL_SELECTION,
  toggleSelected,
} from "../src/ui/selection";

describe("部品の選択状態", () => {
  test("初期状態では注目中の部品がない", () => {
    expect(activePart(INITIAL_SELECTION)).toBeNull();
  });

  test("ホバーした部品が注目中になる", () => {
    const state = hover(INITIAL_SELECTION, "magnets");
    expect(activePart(state)).toBe("magnets");
  });

  test("選択した部品が注目中になる", () => {
    const state = toggleSelected(INITIAL_SELECTION, "shaft");
    expect(activePart(state)).toBe("shaft");
  });

  test("ホバーは選択より優先される", () => {
    const selected = toggleSelected(INITIAL_SELECTION, "shaft");
    const state = hover(selected, "case");
    expect(activePart(state)).toBe("case");
  });

  test("ホバーが外れると選択中の部品へ戻る", () => {
    const selected = toggleSelected(INITIAL_SELECTION, "shaft");
    const state = hover(hover(selected, "case"), null);
    expect(activePart(state)).toBe("shaft");
  });

  test("同じ部品をもう一度選ぶと選択が外れる", () => {
    const once = toggleSelected(INITIAL_SELECTION, "shaft");
    const twice = toggleSelected(once, "shaft");
    expect(twice.selected).toBeNull();
  });

  test("別の部品を選ぶと選択が移る", () => {
    const first = toggleSelected(INITIAL_SELECTION, "shaft");
    const second = toggleSelected(first, "core");
    expect(second.selected).toBe("core");
  });

  test("選択の解除はホバーを保つ", () => {
    const state = hover(toggleSelected(INITIAL_SELECTION, "shaft"), "case");
    const cleared = clearSelected(state);
    expect(cleared).toEqual({ hovered: "case", selected: null });
  });

  test("元の状態を書き換えない", () => {
    const before = { ...INITIAL_SELECTION };
    toggleSelected(INITIAL_SELECTION, "shaft");
    hover(INITIAL_SELECTION, "case");
    expect(INITIAL_SELECTION).toEqual(before);
  });
});
