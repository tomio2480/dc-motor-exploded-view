import type { Vec3 } from "../vec3";
import type { PartId } from "./parts";

/** 引き出し線の始点と，番号ラベルを置く終点．部品の組立位置を基準にする． */
export interface LabelLine {
  /** 引き出し線を付ける個片の番号． */
  readonly piece: number;
  readonly from: Vec3;
  readonly to: Vec3;
}

/** 展開度 1 のときの，個片ごとの組立位置からの移動量． */
export const EXPLODE_OFFSETS: Record<PartId, readonly Vec3[]> = {
  bearing: [[50, 0, 0]],
  case: [[38, 0, 0]],
  magnets: [
    [0, 14, 0],
    [0, -14, 0],
  ],
  shaft: [[0, 0, 0]],
  core: [[0, 0, 0]],
  windings: [[0, 0, 0]],
  commutator: [[0, 0, 0]],
  brushes: [
    [-16, 0, 0],
    [-16, 0, 0],
  ],
  terminals: [
    [-16, 0, 0],
    [-16, 0, 0],
  ],
  endBell: [[-40, 0, 0]],
};

export const LABEL_LINES: Record<PartId, LabelLine> = {
  bearing: { piece: 0, from: [12.8, 2, 0], to: [12.8, 9, 0] },
  case: { piece: 0, from: [0, 10.05, 0], to: [0, 16.5, 0] },
  magnets: { piece: 0, from: [2.5, 9.35, 0], to: [2.5, 15, 0] },
  shaft: { piece: 0, from: [18.5, 1, 0], to: [18.5, 8.5, 0] },
  core: { piece: 0, from: [5.5, 6.5, 0], to: [5.5, 12.5, 0] },
  windings: { piece: 0, from: [-3.5, -2, 4.8], to: [-3.5, -12.5, 4.8] },
  commutator: { piece: 0, from: [-8.75, 2.7, 0], to: [-8.75, 10, 0] },
  brushes: { piece: 0, from: [-8.8, 2.95, 3], to: [-8.8, 10, 3] },
  terminals: { piece: 0, from: [-20, 0.35, 6], to: [-20, -8.5, 6] },
  endBell: { piece: 0, from: [-15, 10.05, 0], to: [-15, 16.5, 0] },
};
