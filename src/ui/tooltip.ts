export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface TooltipPlacement {
  readonly left: number;
  readonly top: number;
}

export interface TooltipRequest {
  readonly pointer: Point;
  readonly size: Size;
  readonly viewport: Size;
  /** ポインターと吹き出しの間隔，および画面端との余白（px）． */
  readonly gap: number;
}

/**
 * 1 軸ぶんの位置を画面内へ収める．
 * 余白を保てないほど画面が狭いときは中央へ寄せる．
 */
function fitInside(
  position: number,
  length: number,
  viewportLength: number,
  gap: number,
): number {
  const max = viewportLength - length - gap;
  if (max < gap) {
    return Math.max(0, (viewportLength - length) / 2);
  }
  return Math.min(Math.max(position, gap), max);
}

/**
 * 吹き出しの左上の位置を決める．
 * ポインターの右下を優先し，はみ出す側だけ反対へ移してから画面内へ収める．
 */
export function placeTooltip(request: TooltipRequest): TooltipPlacement {
  const { pointer, size, viewport, gap } = request;

  const rightSide = pointer.x + gap;
  const fitsRight = rightSide + size.width <= viewport.width - gap;
  const left = fitsRight ? rightSide : pointer.x - gap - size.width;

  const below = pointer.y + gap;
  const fitsBelow = below + size.height <= viewport.height - gap;
  const top = fitsBelow ? below : pointer.y - gap - size.height;

  return {
    left: fitInside(left, size.width, viewport.width, gap),
    top: fitInside(top, size.height, viewport.height, gap),
  };
}
