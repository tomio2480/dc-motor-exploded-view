import { Box3, Mesh, type Object3D, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import { buildMotorParts } from "../src/motor/buildParts";
import { CASE, MAGNET } from "../src/motor/dimensions";
import { EXPLODE_OFFSETS, LABEL_LINES } from "../src/motor/layout";
import { PART_IDS, type PartId } from "../src/motor/parts";

const TOLERANCE = 1e-6;
/** 材質と個片が異なるものだけを別のメッシュにしたときの総数． */
const MAX_MESH_COUNT = 14;
const parts = buildMotorParts();
const eachPart = PART_IDS.map((id) => ({ id }));

function meshesOf(pieces: readonly Object3D[]): Mesh[] {
  const meshes: Mesh[] = [];
  for (const piece of pieces) {
    piece.traverse((object) => {
      if (object instanceof Mesh) {
        meshes.push(object);
      }
    });
  }
  return meshes;
}

/** 部品の外接直方体を返す．展開度 1 のときは個片ごとの移動量を加える． */
function boundsOf(id: PartId, exploded: boolean): Box3 {
  const bounds = new Box3();
  parts[id].forEach((piece, index) => {
    const box = new Box3().setFromObject(piece);
    if (exploded) {
      const offset = EXPLODE_OFFSETS[id][index];
      if (offset === undefined) {
        throw new Error(`移動量の定義がない: ${id} の個片 ${index}`);
      }
      box.translate(new Vector3(...offset));
    }
    bounds.union(box);
  });
  return bounds;
}

/** y-z 平面で，軸から最も遠い頂点までの距離を返す． */
function maxRadiusOf(id: PartId): number {
  let maxRadius = 0;
  const vertex = new Vector3();
  for (const mesh of meshesOf(parts[id])) {
    mesh.updateWorldMatrix(true, false);
    const positions = mesh.geometry.getAttribute("position");
    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index);
      vertex.applyMatrix4(mesh.matrixWorld);
      maxRadius = Math.max(maxRadius, Math.hypot(vertex.y, vertex.z));
    }
  }
  return maxRadius;
}

describe("部品の構成", () => {
  test.each(eachPart)("$id は移動量と同じ数の個片を持つ", ({ id }) => {
    expect(parts[id].length).toBeGreaterThan(0);
    expect(parts[id].length).toBe(EXPLODE_OFFSETS[id].length);
  });

  test.each(eachPart)("$id のメッシュはすべて部品 ID を持つ", ({ id }) => {
    const meshes = meshesOf(parts[id]);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) {
      expect(mesh.userData.partId).toBe(id);
    }
  });

  test.each(eachPart)("$id の引き出し線は実在する個片を指す", ({ id }) => {
    const line = LABEL_LINES[id];
    expect(parts[id][line.piece]).toBeDefined();
    expect(line.from).not.toEqual(line.to);
  });

  test("描画命令を抑えるため，メッシュの総数を少なく保つ", () => {
    const meshCount = PART_IDS.reduce(
      (count, id) => count + meshesOf(parts[id]).length,
      0,
    );
    expect(meshCount).toBeLessThanOrEqual(MAX_MESH_COUNT);
  });

  test("永久磁石とブラシと端子は 2 個ずつある", () => {
    expect(parts.magnets).toHaveLength(2);
    expect(parts.brushes).toHaveLength(2);
    expect(parts.terminals).toHaveLength(2);
  });
});

describe("組立状態の寸法", () => {
  test("ケースの外形は直径と平面間の寸法に一致する", () => {
    const size = boundsOf("case", false).getSize(new Vector3());
    expect(size.y).toBeCloseTo(CASE.radius * 2, 3);
    expect(size.z).toBeCloseTo(CASE.flatHalf * 2, 3);
  });

  test("シャフトはケースの前後へ突き出る", () => {
    const shaft = boundsOf("shaft", false);
    const motorCase = boundsOf("case", false);
    expect(shaft.max.x).toBeGreaterThan(motorCase.max.x);
    expect(shaft.min.x).toBeLessThan(motorCase.min.x);
  });

  test.each([
    { id: "core" },
    { id: "windings" },
    { id: "commutator" },
  ] as const)("回転する $id は永久磁石の内側に収まる", ({ id }) => {
    expect(maxRadiusOf(id)).toBeLessThan(MAGNET.innerRadius);
  });

  test.each([
    { id: "magnets" },
    { id: "core" },
    { id: "windings" },
    { id: "commutator" },
    { id: "brushes" },
  ] as const)("$id はケースの外形の内側に収まる", ({ id }) => {
    const inner = boundsOf(id, false);
    const outer = boundsOf("case", false);
    expect(inner.min.x).toBeGreaterThanOrEqual(outer.min.x - TOLERANCE);
    expect(inner.max.x).toBeLessThanOrEqual(outer.max.x + TOLERANCE);
    expect(inner.max.y).toBeLessThanOrEqual(outer.max.y - CASE.wall);
    expect(inner.min.y).toBeGreaterThanOrEqual(outer.min.y + CASE.wall);
    expect(inner.max.z).toBeLessThanOrEqual(outer.max.z - CASE.wall);
    expect(inner.min.z).toBeGreaterThanOrEqual(outer.min.z + CASE.wall);
  });

  test("端子はエンドベルの後ろへ突き出る", () => {
    expect(boundsOf("terminals", false).min.x).toBeLessThan(
      boundsOf("endBell", false).min.x,
    );
  });

  test("エンドベルはケースの後端をふさぐ位置にある", () => {
    const endBell = boundsOf("endBell", false);
    expect(endBell.max.x).toBeGreaterThanOrEqual(CASE.rearX);
    expect(endBell.min.x).toBeLessThan(CASE.rearX);
  });
});

describe("展開状態の配置", () => {
  const rotorIds = ["shaft", "core", "windings", "commutator"] as const;

  test.each(rotorIds.map((id) => ({ id })))(
    "回転子の $id は展開しても動かない",
    ({ id }) => {
      expect(EXPLODE_OFFSETS[id]).toEqual([[0, 0, 0]]);
    },
  );

  test("部品は軸方向に前から番号順で並ぶ", () => {
    const frontToBack: PartId[] = [
      "bearing",
      "case",
      "shaft",
      "terminals",
      "endBell",
    ];
    for (let index = 0; index + 1 < frontToBack.length; index += 1) {
      const front = boundsOf(frontToBack[index] as PartId, true);
      const back = boundsOf(frontToBack[index + 1] as PartId, true);
      expect(front.min.x).toBeGreaterThan(back.max.x);
    }
  });

  test("永久磁石は回転子の上下へ離れる", () => {
    const windings = boundsOf("windings", true);
    const upper = new Box3().setFromObject(parts.magnets[0] as Object3D);
    const lower = new Box3().setFromObject(parts.magnets[1] as Object3D);
    const [upperOffset, lowerOffset] = EXPLODE_OFFSETS.magnets;
    expect(upper.min.y + (upperOffset?.[1] ?? 0)).toBeGreaterThan(
      windings.max.y,
    );
    expect(lower.max.y + (lowerOffset?.[1] ?? 0)).toBeLessThan(windings.min.y);
  });

  test("ブラシは整流子とエンドベルの間に離れて並ぶ", () => {
    const brushes = boundsOf("brushes", true);
    expect(brushes.max.x).toBeLessThan(boundsOf("commutator", true).min.x);
    expect(brushes.min.x).toBeGreaterThan(boundsOf("endBell", true).max.x);
  });
});
