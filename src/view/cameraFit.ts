import type { Vec3 } from "../vec3";

export interface ViewBasis {
  /** 画面の右方向を表す単位ベクトル． */
  readonly right: Vec3;
  /** 画面の上方向を表す単位ベクトル． */
  readonly up: Vec3;
  /** 注視点からカメラへ向かう単位ベクトル． */
  readonly toCamera: Vec3;
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * 注視点を原点とした点群がすべて画角へ収まる，注視点からカメラまでの最短距離を返す．
 */
export function fitDistance(
  points: readonly Vec3[],
  basis: ViewBasis,
  fovYRad: number,
  aspect: number,
): number {
  if (points.length === 0) {
    throw new RangeError("画角へ収める点が 1 つもない");
  }
  if (!(aspect > 0)) {
    throw new RangeError(`縦横比が正の数値ではない: ${aspect}`);
  }
  const tanVertical = Math.tan(fovYRad / 2);
  const tanHorizontal = tanVertical * aspect;

  let distance = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const depth = dot(point, basis.toCamera);
    const horizontal = Math.abs(dot(point, basis.right)) / tanHorizontal;
    const vertical = Math.abs(dot(point, basis.up)) / tanVertical;
    distance = Math.max(distance, depth + Math.max(horizontal, vertical));
  }
  return distance;
}
