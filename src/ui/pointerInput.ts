import type { PartId } from "../motor/parts";
import type { InfoController } from "./infoController";
import type { Point } from "./tooltip";

/** これより長く動かしたポインター操作は，視点のドラッグとして扱う（px）． */
const DRAG_THRESHOLD_PX = 6;
const PRIMARY_BUTTON = 0;

interface Press {
  readonly pointerId: number;
  readonly position: Point;
}

type Pick = (clientX: number, clientY: number) => PartId | null;

function positionOf(event: PointerEvent): Point {
  return { x: event.clientX, y: event.clientY };
}

/** 押してから離すまでの間に，ほとんど動いていない操作を部品の選択として扱う． */
function bindSelection(
  canvas: HTMLCanvasElement,
  pick: Pick,
  info: InfoController,
): void {
  let press: Press | null = null;

  canvas.addEventListener("pointerdown", (event) => {
    // 右ボタンなどは視点の移動に使うため，選択の対象にしない．
    const isSelecting = event.isPrimary && event.button === PRIMARY_BUTTON;
    press = isSelecting
      ? { pointerId: event.pointerId, position: positionOf(event) }
      : null;
  });

  canvas.addEventListener("pointerup", (event) => {
    if (press === null || press.pointerId !== event.pointerId) {
      return;
    }
    const moved = Math.hypot(
      event.clientX - press.position.x,
      event.clientY - press.position.y,
    );
    press = null;
    if (moved > DRAG_THRESHOLD_PX) {
      return;
    }
    const id = pick(event.clientX, event.clientY);
    if (id === null) {
      info.deselect();
    } else {
      info.toggle(id);
    }
  });

  canvas.addEventListener("pointercancel", () => {
    press = null;
  });
}

/** マウスを重ねた部品を，描画 1 回につき 1 度だけ調べて吹き出しへ反映する． */
function bindHover(
  canvas: HTMLCanvasElement,
  pick: Pick,
  info: InfoController,
): void {
  let pending: Point | null = null;

  function flush(): void {
    if (pending === null) {
      return;
    }
    const position = pending;
    pending = null;
    info.setHover(pick(position.x, position.y), position);
  }

  canvas.addEventListener("pointermove", (event) => {
    // 指での操作は視点の回転に使うため，ホバーはマウスのときだけ扱う．
    if (event.pointerType !== "mouse") {
      return;
    }
    if (event.buttons !== 0) {
      // ドラッグ中は視点が動くため，吹き出しを閉じる．
      pending = null;
      info.setHover(null, null);
      return;
    }
    if (pending === null) {
      requestAnimationFrame(flush);
    }
    pending = positionOf(event);
  });

  canvas.addEventListener("pointerleave", () => {
    pending = null;
    info.setHover(null, null);
  });
}

/** 3D の描画領域でのポインター操作を，部品の選択とホバーへつなぐ． */
export function bindCanvasPointer(
  canvas: HTMLCanvasElement,
  pick: Pick,
  info: InfoController,
): void {
  bindSelection(canvas, pick, info);
  bindHover(canvas, pick, info);
}
