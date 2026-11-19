import {
  type BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  Shape,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  cylindrical,
  extrudeAlongX,
  type MotorParts,
  TERMINAL_CENTER_Y,
  toVectors,
} from "../motor/buildParts";
import {
  coilCurrents,
  type Polarity,
  poleAngle,
  segmentContacts,
  torqueFactors,
} from "../motor/commutation";
import { BRUSH, CORE, MAGNET, TERMINAL, WINDING } from "../motor/dimensions";
import type { CurrentReach } from "../motor/mechanismSteps";
import { ringSectorProfile } from "../motor/profiles";

/** 「回るしくみ」で 3D へ重ねて示す内容． */
export interface MechanismView {
  /** 回転子の角度（ラジアン）． */
  readonly rotorAngle: number;
  readonly polarity: Polarity;
  readonly currentReach: CurrentReach;
  readonly showsPoles: boolean;
  readonly showsForces: boolean;
}

export type MarkerTone = "north" | "south" | "positive" | "negative";

/** 3D 上の位置へ重ねる記号．position はモデルの座標で表す． */
export interface MarkerAnchor {
  readonly id: string;
  readonly text: string;
  readonly tone: MarkerTone;
  readonly isVisible: boolean;
  readonly position: Vector3;
}

export interface MechanismOverlay {
  /** 回転子と一緒に回る表示．回転子のグループへ加える． */
  readonly rotorObjects: Object3D;
  /** 回転子と一緒には回らない表示．モデル全体のグループへ加える． */
  readonly fixedObjects: Object3D;
  /** 表示を切り替える．無効にすると，電流を示す発光も消す． */
  setActive(isActive: boolean): void;
  update(view: MechanismView): void;
  markers(view: MechanismView): MarkerAnchor[];
}

/** 電流が流れている部品を光らせる色． */
const CURRENT_COLOR = 0xffb020;
/** 電流の比が 1 のときの発光の強さ． */
const CURRENT_GLOW = 0.5;
const NORTH_COLOR = 0xc0392b;
const SOUTH_COLOR = 0x2a5db0;
/** 電流が半分のときに，極の色へ混ぜる色とその割合． */
const WEAK_POLE_COLOR = 0xa3a8b0;
const WEAK_POLE_MIX = 0.45;
const FORCE_COLOR = 0x15803d;

/** 突起の先を覆う極の表示の厚み． */
const POLE_CAP_THICKNESS = 0.12;
/** 力の矢印を置く位置．巻線の後ろの端より手前へ出す． */
const ARROW_REAR_OFFSET = 0.6;
const ARROW_X = CORE.rearX - WINDING.thickness - ARROW_REAR_OFFSET;
/** 力の矢印の根元を，突起の外周から内側へ寄せる距離． */
const ARROW_INSET = 0.4;
const ARROW_RADIUS = CORE.headOuterRadius - ARROW_INSET;
const ARROW_SHAFT_RADIUS = 0.18;
const ARROW_HEAD_RADIUS = 0.5;
const ARROW_HEAD_LENGTH = 1.1;
/** 回転力の比が 1 のときの，矢印の軸の長さ． */
const ARROW_MAX_LENGTH = 3.6;
/** これより小さい回転力は，矢印を表示しない． */
const MIN_VISIBLE_TORQUE = 0.03;
/** 矢印がほかの部品に隠れないよう，最後に重ねて描く． */
const OVERLAY_RENDER_ORDER = 10;
/** 円弧や円を多角形で近似するときの分割数． */
const POLE_CAP_ARC_SEGMENTS = 12;
const ARROW_SHAFT_SEGMENTS = 12;
const ARROW_HEAD_SEGMENTS = 16;
/** ブラシに触れない銅片と，それにつながる巻線に流れる電流の比． */
const HALF_CURRENT = 0.5;

interface ForceArrow {
  readonly group: Group;
  readonly shaft: Mesh;
  readonly head: Mesh;
}

function standardMaterialsOf(
  objects: readonly Object3D[],
): MeshStandardMaterial[] {
  const materials = new Set<MeshStandardMaterial>();
  for (const object of objects) {
    object.traverse((child) => {
      if (
        child instanceof Mesh &&
        child.material instanceof MeshStandardMaterial
      ) {
        materials.add(child.material);
      }
    });
  }
  return [...materials];
}

/** メッシュへ付けた番号（極または銅片）の順に，材質を並べて返す． */
function materialsByIndex(
  objects: readonly Object3D[],
  key: "pole" | "segment",
): MeshStandardMaterial[] {
  const materials: MeshStandardMaterial[] = [];
  for (const object of objects) {
    object.traverse((child) => {
      const index: unknown = child.userData[key];
      if (
        child instanceof Mesh &&
        child.material instanceof MeshStandardMaterial &&
        typeof index === "number"
      ) {
        materials[index] = child.material;
      }
    });
  }
  return materials;
}

function setGlow(material: MeshStandardMaterial, level: number): void {
  material.emissive.setHex(CURRENT_COLOR);
  material.emissiveIntensity = CURRENT_GLOW * level;
}

/** 突起の先と後ろの面を覆い，極の色を示す形状を作る． */
function createPoleCap(pole: number): BufferGeometry {
  const sector = (innerRadius: number): Shape =>
    new Shape(
      toVectors(
        ringSectorProfile({
          innerRadius,
          outerRadius: CORE.headOuterRadius + POLE_CAP_THICKNESS,
          centerAngle: poleAngle(pole),
          halfSpan: CORE.headHalfSpan,
          segments: POLE_CAP_ARC_SEGMENTS,
        }),
      ),
    );
  const merged = mergeGeometries([
    extrudeAlongX(sector(CORE.headOuterRadius), CORE.rearX, CORE.frontX),
    extrudeAlongX(
      sector(CORE.headInnerRadius),
      CORE.rearX - POLE_CAP_THICKNESS,
      CORE.rearX,
    ),
  ]);
  if (merged === null) {
    throw new Error(`極の表示の形状をまとめられない: ${pole}`);
  }
  return merged;
}

function createForceArrow(): ForceArrow {
  const material = new MeshBasicMaterial({
    color: FORCE_COLOR,
    depthTest: false,
  });
  // 軸は長さ 1 で作り，回転力に応じて伸縮させる．
  const shaft = new Mesh(
    new CylinderGeometry(
      ARROW_SHAFT_RADIUS,
      ARROW_SHAFT_RADIUS,
      1,
      ARROW_SHAFT_SEGMENTS,
    ).translate(0, 0.5, 0),
    material,
  );
  const head = new Mesh(
    new ConeGeometry(
      ARROW_HEAD_RADIUS,
      ARROW_HEAD_LENGTH,
      ARROW_HEAD_SEGMENTS,
    ).translate(0, ARROW_HEAD_LENGTH / 2, 0),
    material,
  );
  shaft.renderOrder = OVERLAY_RENDER_ORDER;
  head.renderOrder = OVERLAY_RENDER_ORDER;
  const group = new Group();
  group.add(shaft, head);
  return { group, shaft, head };
}

/** 矢印を，突起の位置から力の向きへ伸ばす． */
function placeForceArrow(
  arrow: ForceArrow,
  angle: number,
  torque: number,
): void {
  const length = ARROW_MAX_LENGTH * Math.abs(torque);
  arrow.shaft.scale.y = length;
  arrow.head.position.y = length;
  arrow.group.position.copy(cylindrical(ARROW_X, ARROW_RADIUS, angle));
  // 矢印は y 軸の正の向きに作ってある．軸まわりの接線の向きへ回す．
  arrow.group.rotation.x = angle + (torque > 0 ? Math.PI / 2 : -Math.PI / 2);
}

function poleMarker(
  pole: number,
  current: number,
  view: MechanismView,
): MarkerAnchor {
  const radius = (CORE.headInnerRadius + CORE.headOuterRadius) / 2;
  const isNorth = current > 0;
  return {
    id: `pole-${pole}`,
    text: isNorth ? "N" : "S",
    tone: isNorth ? "north" : "south",
    isVisible: view.showsPoles,
    position: cylindrical(
      CORE.rearX - POLE_CAP_THICKNESS,
      radius,
      poleAngle(pole, view.rotorAngle),
    ),
  };
}

/** 端子の後ろの端に置く，電源の向きの記号． */
function terminalMarker(side: 1 | -1, polarity: Polarity): MarkerAnchor {
  const isPositive = side === polarity;
  return {
    id: side === 1 ? "terminal-upper" : "terminal-lower",
    text: isPositive ? "＋" : "－",
    tone: isPositive ? "positive" : "negative",
    isVisible: true,
    position: new Vector3(
      TERMINAL.rearX,
      side * TERMINAL_CENTER_Y,
      side * BRUSH.reach,
    ),
  };
}

/** 永久磁石の後ろの面に置く，極の記号．上の磁石は内側が N 極である． */
function magnetMarker(side: 1 | -1, isVisible: boolean): MarkerAnchor {
  const isNorth = side === 1;
  return {
    id: isNorth ? "magnet-upper" : "magnet-lower",
    text: isNorth ? "N" : "S",
    tone: isNorth ? "north" : "south",
    isVisible,
    position: new Vector3(
      MAGNET.rearX,
      (side * (MAGNET.innerRadius + MAGNET.outerRadius)) / 2,
      0,
    ),
  };
}

/** 電流・極・力を 3D へ重ねて示す表示を作る． */
export function createMechanismOverlay(parts: MotorParts): MechanismOverlay {
  const coilMaterials = materialsByIndex(parts.windings, "pole");
  const segmentMaterials = materialsByIndex(parts.commutator, "segment");
  const supplyMaterials = standardMaterialsOf([
    ...parts.brushes,
    ...parts.terminals,
  ]);
  const glowing = [...coilMaterials, ...segmentMaterials, ...supplyMaterials];

  const rotorObjects = new Group();
  const poleCaps = Array.from({ length: CORE.poleCount }, (_, pole) => {
    const material = new MeshStandardMaterial({ metalness: 0, roughness: 0.6 });
    rotorObjects.add(new Mesh(createPoleCap(pole), material));
    return material;
  });

  const fixedObjects = new Group();
  const arrows = Array.from({ length: CORE.poleCount }, () => {
    const arrow = createForceArrow();
    fixedObjects.add(arrow.group);
    return arrow;
  });

  function showCurrent(view: MechanismView): void {
    const hasSupply = view.currentReach !== "none";
    for (const material of supplyMaterials) {
      setGlow(material, hasSupply ? 1 : 0);
    }
    const reachesCoils = view.currentReach === "coils";
    const currents = coilCurrents(view.rotorAngle, view.polarity);
    coilMaterials.forEach((material, pole) => {
      setGlow(material, reachesCoils ? Math.abs(currents[pole] ?? 0) : 0);
    });
    // ブラシに触れない銅片も，隣り合う巻線の間で半分の電流を受け渡す．
    const contacts = segmentContacts(view.rotorAngle);
    segmentMaterials.forEach((material, segment) => {
      const level = contacts[segment] === "none" ? HALF_CURRENT : 1;
      setGlow(material, reachesCoils ? level : 0);
    });
  }

  function showPoles(view: MechanismView): void {
    rotorObjects.visible = view.showsPoles;
    const currents = coilCurrents(view.rotorAngle, view.polarity);
    poleCaps.forEach((material, pole) => {
      const current = currents[pole] ?? 0;
      material.color.setHex(current > 0 ? NORTH_COLOR : SOUTH_COLOR);
      if (Math.abs(current) < 1) {
        material.color.lerp(new Color(WEAK_POLE_COLOR), WEAK_POLE_MIX);
      }
    });
  }

  function showForces(view: MechanismView): void {
    const torques = torqueFactors(view.rotorAngle, view.polarity);
    arrows.forEach((arrow, pole) => {
      const torque = torques[pole] ?? 0;
      arrow.group.visible =
        view.showsForces && Math.abs(torque) > MIN_VISIBLE_TORQUE;
      placeForceArrow(arrow, poleAngle(pole, view.rotorAngle), torque);
    });
  }

  rotorObjects.visible = false;
  fixedObjects.visible = false;

  return {
    rotorObjects,
    fixedObjects,
    setActive(isActive) {
      fixedObjects.visible = isActive;
      if (!isActive) {
        rotorObjects.visible = false;
        for (const material of glowing) {
          setGlow(material, 0);
        }
      }
    },
    update(view) {
      showCurrent(view);
      showPoles(view);
      showForces(view);
    },
    markers(view) {
      const currents = coilCurrents(view.rotorAngle, view.polarity);
      return [
        terminalMarker(1, view.polarity),
        terminalMarker(-1, view.polarity),
        magnetMarker(1, view.showsPoles),
        magnetMarker(-1, view.showsPoles),
        ...currents.map((current, pole) => poleMarker(pole, current, view)),
      ];
    },
  };
}
