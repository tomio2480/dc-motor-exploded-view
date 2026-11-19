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

/** これより短いベクトルは，向きを決められないものとして扱う． */
const MIN_DIRECTION_LENGTH = 1e-9;

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(vector: Vec3, description: string): Vec3 {
  const length = Math.hypot(...vector);
  if (!(length > MIN_DIRECTION_LENGTH)) {
    throw new RangeError(`${description}: ${vector.join(", ")}`);
  }
  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

/** 注視点からカメラへ向かう方向から，上を y 軸の正とした画面の基底を求める． */
export function viewBasis(toCamera: Vec3): ViewBasis {
  const forward = normalize(toCamera, "視線の方向の長さが 0 である");
  const right = normalize(
    cross([0, 1, 0], forward),
    "真上または真下からの視線では画面の右を決められない",
  );
  return { right, up: cross(forward, right), toCamera: forward };
}
