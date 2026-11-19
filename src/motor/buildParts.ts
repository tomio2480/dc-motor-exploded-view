import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  Group,
  type Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  Path,
  QuadraticBezierCurve3,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { poleAngle, segmentAngle } from "./commutation";
import {
  BEARING,
  BRUSH,
  CASE,
  COMMUTATOR,
  CORE,
  END_BELL,
  MAGNET,
  SHAFT,
  TERMINAL,
  WINDING,
} from "./dimensions";
import type { PartId } from "./parts";
import {
  armatureProfile,
  flattedCircleProfile,
  type Point2,
  ringSectorProfile,
} from "./profiles";

/** 部品 ID ごとの個片．個片は組立位置の座標で形状を持つ． */
export type MotorParts = Record<PartId, Object3D[]>;

const ARC_SEGMENTS = 24;
const CIRCLE_SEGMENTS = 48;
const FULL_TURN = 2 * Math.PI;

/** 断面の (u, v, 押し出し方向) を，モデルの (y, z, x) へ移す回転． */
const PROFILE_TO_MODEL = new Matrix4().set(
  ...[0, 0, 1, 0],
  ...[1, 0, 0, 0],
  ...[0, 1, 0, 0],
  ...[0, 0, 0, 1],
);

function toVectors(points: readonly Point2[]): Vector2[] {
  return points.map(([u, v]) => new Vector2(u, v));
}

function circlePath(radius: number): Path {
  return new Path().absarc(0, 0, radius, 0, FULL_TURN, false);
}

function circleShape(radius: number): Shape {
  return new Shape().absarc(0, 0, radius, 0, FULL_TURN, false);
}

function rectanglePath(
  centerU: number,
  centerV: number,
  halfU: number,
  halfV: number,
): Path {
  return new Path(
    toVectors([
      [centerU - halfU, centerV - halfV],
      [centerU + halfU, centerV - halfV],
      [centerU + halfU, centerV + halfV],
      [centerU - halfU, centerV + halfV],
    ]),
  );
}

/** y-z 平面の断面を，x 軸に沿って rearX から frontX まで押し出す． */
function extrudeAlongX(
  shape: Shape,
  rearX: number,
  frontX: number,
): BufferGeometry {
  const geometry = new ExtrudeGeometry(shape, {
    depth: frontX - rearX,
    bevelEnabled: false,
    curveSegments: CIRCLE_SEGMENTS,
  });
  geometry.applyMatrix4(PROFILE_TO_MODEL);
  geometry.translate(rearX, 0, 0);
  return geometry;
}

function metal(color: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0.9, roughness });
}

function nonMetal(color: number, roughness: number): MeshStandardMaterial {
  return new MeshStandardMaterial({ color, metalness: 0, roughness });
}

function createMesh(
  partId: PartId,
  geometry: BufferGeometry,
  material: Material,
): Mesh {
  const mesh = new Mesh(geometry, material);
  mesh.userData.partId = partId;
  return mesh;
}

/**
 * 同じ材質の形状を 1 つのメッシュへまとめる．
 * 描画命令の数を減らし，スマートフォンでの描画の負荷を抑える．
 */
function createMergedMesh(
  partId: PartId,
  geometries: BufferGeometry[],
  material: Material,
): Mesh {
  const merged = mergeGeometries(geometries);
  if (merged === null) {
    throw new Error(`形状をまとめられない: ${partId}`);
  }
  return createMesh(partId, merged, material);
}

function createPiece(partId: PartId, meshes: readonly Mesh[]): Group {
  const piece = new Group();
  piece.userData.partId = partId;
  piece.add(...meshes);
  return piece;
}

function buildCase(): Object3D[] {
  const material = metal(0xb9bec6, 0.38);
  const plateRearX = CASE.frontX - CASE.wall;

  const tube = new Shape(
    toVectors(flattedCircleProfile(CASE.radius, CASE.flatHalf, ARC_SEGMENTS)),
  );
  tube.holes.push(
    new Path(
      toVectors(
        flattedCircleProfile(
          CASE.radius - CASE.wall,
          CASE.flatHalf - CASE.wall,
          ARC_SEGMENTS,
        ),
      ),
    ),
  );

  const frontPlate = new Shape(
    toVectors(flattedCircleProfile(CASE.radius, CASE.flatHalf, ARC_SEGMENTS)),
  );
  frontPlate.holes.push(circlePath(BEARING.outerRadius));

  const boss = circleShape(CASE.bossRadius);
  boss.holes.push(circlePath(BEARING.outerRadius));

  return [
    createPiece("case", [
      createMergedMesh(
        "case",
        [
          extrudeAlongX(tube, CASE.rearX, plateRearX),
          extrudeAlongX(frontPlate, plateRearX, CASE.frontX),
          extrudeAlongX(boss, CASE.frontX, CASE.frontX + CASE.bossLength),
        ],
        material,
      ),
    ]),
  ];
}

function buildBearing(): Object3D[] {
  const sleeve = circleShape(BEARING.outerRadius);
  sleeve.holes.push(circlePath(SHAFT.radius));
  return [
    createPiece("bearing", [
      createMesh(
        "bearing",
        extrudeAlongX(sleeve, BEARING.rearX, BEARING.frontX),
        metal(0xb5894f, 0.5),
      ),
    ]),
  ];
}

function buildMagnets(): Object3D[] {
  const poles = [
    { centerAngle: 0, color: 0x8f2f2a },
    { centerAngle: Math.PI, color: 0x2a488f },
  ];
  return poles.map(({ centerAngle, color }) => {
    const sector = new Shape(
      toVectors(
        ringSectorProfile({
          innerRadius: MAGNET.innerRadius,
          outerRadius: MAGNET.outerRadius,
          centerAngle,
          halfSpan: MAGNET.halfSpan,
          segments: ARC_SEGMENTS,
        }),
      ),
    );
    return createPiece("magnets", [
      createMesh(
        "magnets",
        extrudeAlongX(sector, MAGNET.rearX, MAGNET.frontX),
        nonMetal(color, 0.75),
      ),
    ]);
  });
}

function buildShaft(): Object3D[] {
  const length = SHAFT.frontX - SHAFT.rearX;
  const geometry = new CylinderGeometry(
    SHAFT.radius,
    SHAFT.radius,
    length,
    CIRCLE_SEGMENTS,
  );
  // 円柱は y 軸に沿って作られるため，x 軸へ倒す．
  geometry.rotateZ(-Math.PI / 2);
  geometry.translate((SHAFT.frontX + SHAFT.rearX) / 2, 0, 0);
  return [
    createPiece("shaft", [
      createMesh("shaft", geometry, metal(0xdde1e6, 0.22)),
    ]),
  ];
}

function buildCore(): Object3D[] {
  const lamination = new Shape(
    toVectors(armatureProfile({ ...CORE, segments: ARC_SEGMENTS / 2 })),
  );
  lamination.holes.push(circlePath(SHAFT.radius));

  const length = CORE.frontX - CORE.rearX;
  const totalGap = CORE.laminationGap * (CORE.laminationCount - 1);
  const thickness = (length - totalGap) / CORE.laminationCount;
  const pitch = thickness + CORE.laminationGap;
  const sheet = extrudeAlongX(lamination, 0, thickness);

  const sheets: BufferGeometry[] = [];
  for (let index = 0; index < CORE.laminationCount; index += 1) {
    sheets.push(sheet.clone().translate(CORE.rearX + index * pitch, 0, 0));
  }
  return [
    createPiece("core", [
      createMergedMesh("core", sheets, metal(0x80848b, 0.55)),
    ]),
  ];
}

/** 柱を囲む角の丸い輪を，巻線 1 層ぶんの断面として返す． */
function coilLayerShape(): Shape {
  const halfLength = (CORE.frontX - CORE.rearX) / 2;
  const outerHalfWidth = CORE.stemHalfWidth + WINDING.thickness;
  const outerHalfLength = halfLength + WINDING.thickness;
  const corner = WINDING.thickness;

  const shape = new Shape()
    .moveTo(-outerHalfWidth + corner, -outerHalfLength)
    .lineTo(outerHalfWidth - corner, -outerHalfLength)
    .absarc(
      outerHalfWidth - corner,
      -outerHalfLength + corner,
      corner,
      -Math.PI / 2,
      0,
      false,
    )
    .lineTo(outerHalfWidth, outerHalfLength - corner)
    .absarc(
      outerHalfWidth - corner,
      outerHalfLength - corner,
      corner,
      0,
      Math.PI / 2,
      false,
    )
    .lineTo(-outerHalfWidth + corner, outerHalfLength)
    .absarc(
      -outerHalfWidth + corner,
      outerHalfLength - corner,
      corner,
      Math.PI / 2,
      Math.PI,
      false,
    )
    .lineTo(-outerHalfWidth, -outerHalfLength + corner)
    .absarc(
      -outerHalfWidth + corner,
      -outerHalfLength + corner,
      corner,
      Math.PI,
      (3 * Math.PI) / 2,
      false,
    );
  shape.holes.push(rectanglePath(0, 0, CORE.stemHalfWidth, halfLength));
  return shape;
}

/** 軸方向の位置・軸からの距離・軸まわりの角度で表した点を，モデルの座標へ直す． */
function cylindrical(x: number, radius: number, angle: number): Vector3 {
  return new Vector3(x, radius * Math.cos(angle), radius * Math.sin(angle));
}

/** 引き出し線をつなぐ突起の，軸方向の中心． */
const TAB_CENTER_X = COMMUTATOR.frontX - COMMUTATOR.tabLength / 2;
/** 巻線が鉄心の後ろへはみ出した端の，軸方向の位置． */
const COIL_REAR_X = CORE.rearX - WINDING.thickness;
/** 引き出し線の付け根を巻線の中へ埋める深さ． */
const LEAD_EMBED_DEPTH = 0.3;
/** 引き出し線の曲がりの頂点を，巻線の端から後ろへずらす距離． */
const LEAD_BEND_OFFSET = 0.9;

/**
 * 巻線の端から整流子の突起までの引き出し線を作る．
 * side が +1 なら反時計回りの隣，-1 なら時計回りの隣の銅片へつなぐ．
 */
function createLead(pole: number, side: 1 | -1): BufferGeometry {
  const coilRadius = (WINDING.innerRadius + WINDING.outerRadius) / 2;
  const startRadius = Math.hypot(coilRadius, WINDING.leadOffset);
  const startAngle =
    poleAngle(pole) + side * Math.atan2(WINDING.leadOffset, coilRadius);
  const endAngle = segmentAngle(side === 1 ? pole : pole - 1);

  const path = new QuadraticBezierCurve3(
    cylindrical(COIL_REAR_X + LEAD_EMBED_DEPTH, startRadius, startAngle),
    cylindrical(
      COIL_REAR_X - LEAD_BEND_OFFSET,
      startRadius,
      (startAngle + endAngle) / 2,
    ),
    cylindrical(TAB_CENTER_X, COMMUTATOR.tabOuterRadius, endAngle),
  );
  // 押し出しで作る層と同じ形式へそろえ，1 つのメッシュへまとめられるようにする．
  return new TubeGeometry(
    path,
    ARC_SEGMENTS / 2,
    WINDING.leadRadius,
    6,
    false,
  ).toNonIndexed();
}

function buildWindings(): Object3D[] {
  const layerDepth =
    (WINDING.outerRadius - WINDING.innerRadius) / WINDING.layerCount;
  // 層の角を丸め，重ねた層の境目を電線の並びのように見せる．
  const bevel = layerDepth / 4;
  const layerGeometry = new ExtrudeGeometry(coilLayerShape(), {
    depth: layerDepth - 2 * bevel,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: -bevel,
    bevelSegments: 2,
    curveSegments: ARC_SEGMENTS / 2,
  });
  const centerX = (CORE.frontX + CORE.rearX) / 2;
  const axial = new Vector3(1, 0, 0);

  // 極ごとに流れる電流が異なるため，極ごとに別のメッシュと材質を持たせる．
  const meshes: Mesh[] = [];
  for (let pole = 0; pole < CORE.poleCount; pole += 1) {
    const angle = poleAngle(pole);
    const radial = new Vector3(0, Math.cos(angle), Math.sin(angle));
    const tangential = new Vector3(0, -Math.sin(angle), Math.cos(angle));
    // 層の断面の (幅，軸方向，重ねる方向) を，突起の (接線，x 軸，半径) へ向ける．
    const placement = new Matrix4().makeBasis(tangential, axial, radial);

    const geometries = [createLead(pole, 1), createLead(pole, -1)];
    for (let layer = 0; layer < WINDING.layerCount; layer += 1) {
      const radius = WINDING.innerRadius + bevel + layer * layerDepth;
      placement.setPosition(
        radial.clone().multiplyScalar(radius).setX(centerX),
      );
      geometries.push(layerGeometry.clone().applyMatrix4(placement));
    }
    const mesh = createMergedMesh(
      "windings",
      geometries,
      metal(0xc56a33, 0.42),
    );
    mesh.userData.pole = pole;
    meshes.push(mesh);
  }
  return [createPiece("windings", meshes)];
}

/** 引き出し線をつなぐ突起を，銅片の前端に作る． */
function createTab(segment: number): BufferGeometry {
  const angle = segmentAngle(segment);
  // 銅片との間にすき間が見えないよう，根元を銅片の中へ少し埋める．
  const innerRadius = COMMUTATOR.hubRadius;
  const height = COMMUTATOR.tabOuterRadius - innerRadius;
  const radial = new Vector3(0, Math.cos(angle), Math.sin(angle));
  const tangential = new Vector3(0, -Math.sin(angle), Math.cos(angle));
  // 直方体の (幅，高さ，奥行き) を，突起の (x 軸，半径，接線) へ向ける．
  const placement = new Matrix4()
    .makeBasis(new Vector3(1, 0, 0), radial, tangential)
    .setPosition(cylindrical(TAB_CENTER_X, innerRadius + height / 2, angle));
  return new BoxGeometry(COMMUTATOR.tabLength, height, COMMUTATOR.tabWidth)
    .toNonIndexed()
    .applyMatrix4(placement);
}

function buildCommutator(): Object3D[] {
  const insulator = circleShape(COMMUTATOR.hubRadius);
  insulator.holes.push(circlePath(SHAFT.radius));
  const meshes = [
    createMesh(
      "commutator",
      extrudeAlongX(
        insulator,
        COMMUTATOR.rearX - COMMUTATOR.hubOverhang,
        COMMUTATOR.frontX + COMMUTATOR.hubOverhang,
      ),
      nonMetal(0x4d3d34, 0.8),
    ),
  ];

  // 銅片ごとに電位が異なるため，銅片ごとに別のメッシュと材質を持たせる．
  for (let segment = 0; segment < COMMUTATOR.segmentCount; segment += 1) {
    const sector = new Shape(
      toVectors(
        ringSectorProfile({
          innerRadius: COMMUTATOR.hubRadius,
          outerRadius: COMMUTATOR.outerRadius,
          centerAngle: segmentAngle(segment),
          halfSpan: COMMUTATOR.segmentHalfSpan,
          segments: ARC_SEGMENTS / 2,
        }),
      ),
    );
    const mesh = createMergedMesh(
      "commutator",
      [
        extrudeAlongX(sector, COMMUTATOR.rearX, COMMUTATOR.frontX),
        createTab(segment),
      ],
      metal(0xd98f58, 0.3),
    );
    mesh.userData.segment = segment;
    meshes.push(mesh);
  }
  return [createPiece("commutator", meshes)];
}

/** 上側（+1）と下側（-1）．2 個の部品は軸について点対称に置く． */
const SIDES = [1, -1] as const;

/** ブラシが整流子へ触れる面の y 座標の絶対値． */
const BRUSH_CONTACT_Y = COMMUTATOR.outerRadius;
/** 端子の板の中心の y 座標の絶対値．板の外側の縁をブラシの外面へそろえる． */
const TERMINAL_CENTER_Y =
  BRUSH_CONTACT_Y + BRUSH.thickness - TERMINAL.widthY / 2;

function buildBrushes(): Object3D[] {
  const material = metal(0xcaa25c, 0.36);
  const lengthZ = BRUSH.reach + BRUSH.tipOverrun;
  return SIDES.map((side) => {
    const geometry = new BoxGeometry(BRUSH.widthX, BRUSH.thickness, lengthZ);
    geometry.translate(
      BRUSH.centerX,
      side * (BRUSH_CONTACT_Y + BRUSH.thickness / 2),
      (side * (BRUSH.reach - BRUSH.tipOverrun)) / 2,
    );
    return createPiece("brushes", [createMesh("brushes", geometry, material)]);
  });
}

function buildTerminals(): Object3D[] {
  const material = metal(0xd6b560, 0.34);
  const halfWidth = TERMINAL.widthY / 2;
  return SIDES.map((side) => {
    const centerY = side * TERMINAL_CENTER_Y;
    const plate = new Shape(
      toVectors([
        [TERMINAL.rearX, centerY - halfWidth],
        [TERMINAL.frontX, centerY - halfWidth],
        [TERMINAL.frontX, centerY + halfWidth],
        [TERMINAL.rearX, centerY + halfWidth],
      ]),
    );
    plate.holes.push(
      new Path().absarc(
        TERMINAL.rearX + TERMINAL.holeInset,
        centerY,
        TERMINAL.holeRadius,
        0,
        FULL_TURN,
        false,
      ),
    );
    // 板は x-y 平面の形を z 方向へ押し出すため，軸の入れ替えは要らない．
    const geometry = new ExtrudeGeometry(plate, {
      depth: TERMINAL.thickness,
      bevelEnabled: false,
      curveSegments: ARC_SEGMENTS,
    });
    geometry.translate(0, 0, side * BRUSH.reach - TERMINAL.thickness / 2);
    return createPiece("terminals", [
      createMesh("terminals", geometry, material),
    ]);
  });
}

function buildEndBell(): Object3D[] {
  const material = nonMetal(0xd8d2c2, 0.6);

  const cover = new Shape(
    toVectors(flattedCircleProfile(CASE.radius, CASE.flatHalf, ARC_SEGMENTS)),
  );
  cover.holes.push(circlePath(SHAFT.radius));
  for (const side of SIDES) {
    cover.holes.push(
      rectanglePath(
        side * TERMINAL_CENTER_Y,
        side * BRUSH.reach,
        TERMINAL.widthY / 2 + END_BELL.slotClearance,
        TERMINAL.thickness / 2 + END_BELL.slotClearance,
      ),
    );
  }

  const lipRadius = CASE.radius - CASE.wall - END_BELL.lipClearance;
  const lipFlatHalf = CASE.flatHalf - CASE.wall - END_BELL.lipClearance;
  const lip = new Shape(
    toVectors(flattedCircleProfile(lipRadius, lipFlatHalf, ARC_SEGMENTS)),
  );
  lip.holes.push(
    new Path(
      toVectors(
        flattedCircleProfile(
          lipRadius - END_BELL.lipThickness,
          lipFlatHalf - END_BELL.lipThickness,
          ARC_SEGMENTS,
        ),
      ),
    ),
  );

  return [
    createPiece("endBell", [
      createMergedMesh(
        "endBell",
        [
          extrudeAlongX(cover, END_BELL.rearX, END_BELL.frontX),
          extrudeAlongX(
            lip,
            END_BELL.frontX,
            END_BELL.frontX + END_BELL.lipLength,
          ),
          extrudeAlongX(
            circleShape(END_BELL.bossRadius),
            END_BELL.rearX - END_BELL.bossLength,
            END_BELL.rearX,
          ),
        ],
        material,
      ),
    ]),
  ];
}

/** すべての部品を，組立位置の座標で作る． */
export function buildMotorParts(): MotorParts {
  return {
    bearing: buildBearing(),
    case: buildCase(),
    magnets: buildMagnets(),
    shaft: buildShaft(),
    core: buildCore(),
    windings: buildWindings(),
    commutator: buildCommutator(),
    brushes: buildBrushes(),
    terminals: buildTerminals(),
    endBell: buildEndBell(),
  };
}
