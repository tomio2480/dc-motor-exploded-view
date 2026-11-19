const KEY_ORBIT_STEP = Math.PI / 18;
const KEY_ZOOM_STEP = 0.85;

export interface ViewKeyTarget {
  orbitBy(horizontal: number, vertical: number): void;
  zoomBy(scale: number): void;
}

export interface KeyboardOptions {
  readonly view: ViewKeyTarget;
  /** Escape キーで呼ぶ． */
  readonly onEscape: () => void;
  /** キーをそれ自身の操作に使う要素かどうかを返す． */
  readonly usesKeysItself: (target: EventTarget | null) => boolean;
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey;
}

/** 文書全体で，視点を操作するキーと Escape キーを受け付ける． */
export function bindKeyboard(options: KeyboardOptions): void {
  const { view, onEscape, usesKeysItself } = options;
  const viewActions: Record<string, () => void> = {
    ArrowLeft: () => view.orbitBy(-KEY_ORBIT_STEP, 0),
    ArrowRight: () => view.orbitBy(KEY_ORBIT_STEP, 0),
    ArrowUp: () => view.orbitBy(0, -KEY_ORBIT_STEP),
    ArrowDown: () => view.orbitBy(0, KEY_ORBIT_STEP),
    "+": () => view.zoomBy(KEY_ZOOM_STEP),
    "-": () => view.zoomBy(1 / KEY_ZOOM_STEP),
  };

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      onEscape();
      return;
    }
    const action = viewActions[event.key];
    if (
      action === undefined ||
      hasModifier(event) ||
      usesKeysItself(event.target)
    ) {
      return;
    }
    event.preventDefault();
    action();
  });
}
