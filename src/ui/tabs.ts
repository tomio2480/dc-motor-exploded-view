/** 矢印キーなどで移る先のタブの番号を返す．対象外のキーでは null を返す． */
function targetIndex(
  key: string,
  current: number,
  count: number,
): number | null {
  const targets: Record<string, number> = {
    ArrowRight: (current + 1) % count,
    ArrowLeft: (current - 1 + count) % count,
    Home: 0,
    End: count - 1,
  };
  return targets[key] ?? null;
}

/**
 * タブの一覧へ，選択の切り替えとキーボード操作を付ける．
 * 選んだタブだけを Tab キーの移動先にし，矢印キーでタブの間を移る．
 */
export function bindTabs(
  tabs: readonly HTMLElement[],
  onSelect: (index: number) => void,
): void {
  function select(index: number): void {
    // 選択中のタブを選び直しても，表示をやり直さない．
    if (tabs[index]?.getAttribute("aria-selected") === "true") {
      return;
    }
    tabs.forEach((tab, tabIndex) => {
      const isSelected = tabIndex === index;
      tab.setAttribute("aria-selected", String(isSelected));
      tab.tabIndex = isSelected ? 0 : -1;
    });
    onSelect(index);
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => {
      select(index);
    });
    tab.addEventListener("keydown", (event) => {
      // Alt + 矢印キーなどのブラウザーの操作を妨げない．
      const hasModifier = event.altKey || event.ctrlKey || event.metaKey;
      const next = targetIndex(event.key, index, tabs.length);
      if (hasModifier || next === null) {
        return;
      }
      event.preventDefault();
      tabs[next]?.focus();
      select(next);
    });
  });
}
