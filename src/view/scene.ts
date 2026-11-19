import {
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  Group,
  Line,
  LineBasicMaterial,
  Mesh,
  MeshStandardMaterial,
  NeutralToneMapping,
  type Object3D,
  PerspectiveCamera,
  PMREMGenerator,
  Raycaster,
  Scene,
  Spherical,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { buildMotorParts } from "../motor/buildParts";
import { EXPLODE_OFFSETS, LABEL_LINES } from "../motor/layout";
import { isPartId, PART_IDS, type PartId } from "../motor/parts";
import type { Vec3 } from "../vec3";
import { fitDistance } from "./cameraFit";
import { clampFactor, explodedOffset, labelOpacity } from "./explode";

/** 番号ラベルを置く画面上の位置．描画領域の左上を原点とする CSS ピクセル． */
export interface LabelPosition {
  readonly id: PartId;
  readonly x: number;
  readonly y: number;
}

export interface MotorSceneOptions {
  readonly reducedMotion: boolean;
  /** 縦長の画面かどうか．縦長ではモーターの軸を縦へ向ける． */
  readonly portrait: boolean;
  /** 引き出し線の色．CSS の色表記で渡す． */
  readonly lineColor: string;
  /** 描画のたびに，番号ラベルの位置と不透明度を受け取る． */
  readonly onRender: (
    labels: readonly LabelPosition[],
    opacity: number,
  ) => void;
}

export interface MotorScene {
  setFactor(factor: number): void;
  setHighlight(id: PartId | null): void;
  setLineColor(color: string): void;
  /** 画面上の位置にある部品を返す．部品がなければ null を返す． */
  pick(clientX: number, clientY: number): PartId | null;
  /** 視点を水平方向と垂直方向へ回す．角度はラジアンで渡す． */
  orbitBy(horizontal: number, vertical: number): void;
  /** 注視点までの距離を倍率で変える．1 より小さい値で近づく． */
  zoomBy(scale: number): void;
  /** 画面の向きに合わせてモデルの向きを切り替え，視点を初期の向きへ戻す． */
  setPortrait(portrait: boolean): void;
  resetView(): void;
  /** 描画領域の大きさの変化へ追従する．利用者が変えた拡大率と注視点は保つ． */
  resize(): void;
}

const FOV_DEGREES = 28;
/** 画面の端と部品の間に残す余白の倍率． */
const FIT_MARGIN = 1.14;
const MAX_PIXEL_RATIO = 2;
const TONE_EXPOSURE = 0.95;
const ENVIRONMENT_INTENSITY = 0.7;
const KEY_LIGHT_INTENSITY = 1.1;
const HIGHLIGHT_COLOR = 0x1f8fff;
const HIGHLIGHT_INTENSITY = 0.55;
/** 画角合わせで決めた距離に対する，拡大と縮小の限度． */
const ZOOM_IN_LIMIT = 0.2;
const ZOOM_OUT_LIMIT = 2.5;
/** 真上と真下を避けるための，垂直方向の角度の余裕． */
const POLAR_MARGIN = 0.05;

/** 横長の画面で，注視点からカメラへ向かう方向． */
const LANDSCAPE_VIEW: Vec3 = [0.5, 0.36, 1];
/** 縦長の画面で，注視点からカメラへ向かう方向． */
const PORTRAIT_VIEW: Vec3 = [0.42, 0.16, 1];

interface Piece {
  readonly object: Object3D;
  readonly offset: Vec3;
  readonly bounds: Box3;
}

/** 画角合わせで決めた注視点と距離．利用者による拡大と移動の基準にする． */
interface FittedView {
  readonly target: Vector3;
  readonly distance: number;
}

interface LabelLineObject {
  readonly id: PartId;
  readonly line: Line;
  readonly offset: Vec3;
  readonly from: Vector3;
  readonly to: Vector3;
}

function boxCorners(box: Box3): Vector3[] {
  const corners: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        corners.push(new Vector3(x, y, z));
      }
    }
  }
  return corners;
}

function collectMaterials(pieces: readonly Object3D[]): MeshStandardMaterial[] {
  const materials = new Set<MeshStandardMaterial>();
  for (const piece of pieces) {
    piece.traverse((object) => {
      if (
        object instanceof Mesh &&
        object.material instanceof MeshStandardMaterial
      ) {
        materials.add(object.material);
      }
    });
  }
  return [...materials];
}

/**
 * モーターの 3D 表示を作る．
 * WebGL を使えない環境では，レンダラーの生成時に例外が発生する．
 */
export function createMotorScene(
  canvas: HTMLCanvasElement,
  options: MotorSceneOptions,
): MotorScene {
  const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
  renderer.toneMapping = NeutralToneMapping;
  renderer.toneMappingExposure = TONE_EXPOSURE;

  const scene = new Scene();
  const environment = new PMREMGenerator(renderer).fromScene(
    new RoomEnvironment(),
  );
  scene.environment = environment.texture;
  scene.environmentIntensity = ENVIRONMENT_INTENSITY;
  const keyLight = new DirectionalLight(0xffffff, KEY_LIGHT_INTENSITY);
  keyLight.position.set(40, 80, 60);
  scene.add(keyLight);

  const camera = new PerspectiveCamera(FOV_DEGREES, 1, 1, 1000);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = !options.reducedMotion;
  controls.minPolarAngle = POLAR_MARGIN;
  controls.maxPolarAngle = Math.PI - POLAR_MARGIN;

  // 縦長の画面では軸を縦へ向けるため，モデル全体をこのグループごと回す．
  const root = new Group();
  scene.add(root);

  const parts = buildMotorParts();
  const pieces: Piece[] = [];
  const pickables: Object3D[] = [];
  const materialsByPart = new Map<PartId, MeshStandardMaterial[]>();
  for (const id of PART_IDS) {
    materialsByPart.set(id, collectMaterials(parts[id]));
    parts[id].forEach((object, index) => {
      const offset = EXPLODE_OFFSETS[id][index];
      if (offset === undefined) {
        throw new Error(`移動量の定義がない: ${id} の個片 ${index}`);
      }
      root.add(object);
      pieces.push({ object, offset, bounds: new Box3().setFromObject(object) });
      object.traverse((child) => {
        if (child instanceof Mesh) {
          pickables.push(child);
        }
      });
    });
  }

  const lineMaterial = new LineBasicMaterial({
    color: new Color(options.lineColor),
    transparent: true,
  });
  const labelLines: LabelLineObject[] = PART_IDS.map((id) => {
    const definition = LABEL_LINES[id];
    const offset = EXPLODE_OFFSETS[id][definition.piece];
    if (offset === undefined) {
      throw new Error(`引き出し線が指す個片がない: ${id}`);
    }
    const from = new Vector3(...definition.from);
    const to = new Vector3(...definition.to);
    const line = new Line(
      new BufferGeometry().setFromPoints([from, to]),
      lineMaterial,
    );
    root.add(line);
    return { id, line, offset, from, to };
  });

  let factor = 1;
  let isPortrait = options.portrait;
  let fitted: FittedView | null = null;
  let highlighted: PartId | null = null;
  let needsRender = true;
  const raycaster = new Raycaster();

  function applyFactor(): void {
    for (const piece of pieces) {
      piece.object.position.set(...explodedOffset(piece.offset, factor));
    }
    const opacity = labelOpacity(factor);
    lineMaterial.opacity = opacity;
    for (const labelLine of labelLines) {
      labelLine.line.position.set(...explodedOffset(labelLine.offset, factor));
      labelLine.line.visible = opacity > 0;
    }
  }

  /** 画角へ収める対象の点を，ワールド座標で返す． */
  function framePoints(): Vector3[] {
    root.updateMatrixWorld(true);
    const points: Vector3[] = [];
    for (const piece of pieces) {
      const shift = new Vector3(...explodedOffset(piece.offset, factor));
      for (const corner of boxCorners(piece.bounds)) {
        points.push(corner.add(shift));
      }
    }
    // ラベルの現れ方に合わせて引き出し線の先端を含め，画角の急な変化を避ける．
    const opacity = labelOpacity(factor);
    for (const labelLine of labelLines) {
      const shift = new Vector3(...explodedOffset(labelLine.offset, factor));
      points.push(
        labelLine.from.clone().lerp(labelLine.to, opacity).add(shift),
      );
    }
    return points.map((point) => root.localToWorld(point));
  }

  /**
   * 現在の視線の向きを保ったまま，全体が収まる距離へカメラを置く．
   * keepUserView が真なら，利用者が変えた拡大率と注視点のずれを引き継ぐ．
   */
  function fitView(keepUserView: boolean): void {
    const points = framePoints();
    const target = new Box3().setFromPoints(points).getCenter(new Vector3());
    const offset = camera.position.clone().sub(controls.target);
    const direction = offset.clone().normalize();
    const previous = keepUserView ? fitted : null;
    const zoom = previous === null ? 1 : offset.length() / previous.distance;
    const pan =
      previous === null
        ? new Vector3()
        : controls.target.clone().sub(previous.target);

    camera.position.copy(target).add(direction);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);

    const distance =
      FIT_MARGIN *
      fitDistance(
        points.map((point) => point.sub(target).toArray()),
        {
          right: right.toArray(),
          up: up.toArray(),
          toCamera: direction.toArray(),
        },
        (camera.fov * Math.PI) / 180,
        camera.aspect,
      );
    fitted = { target, distance };

    controls.target.copy(target).add(pan);
    controls.minDistance = distance * ZOOM_IN_LIMIT;
    controls.maxDistance = distance * ZOOM_OUT_LIMIT;
    camera.position
      .copy(controls.target)
      .addScaledVector(direction, distance * zoom);
    camera.near = distance / 100;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();
    controls.update();
    needsRender = true;
  }

  /** モデルとカメラを，画面の向きに応じた初期の向きへ置く． */
  function placeDefaultView(): void {
    root.rotation.z = isPortrait ? Math.PI / 2 : 0;
    controls.target.set(0, 0, 0);
    camera.position.set(...(isPortrait ? PORTRAIT_VIEW : LANDSCAPE_VIEW));
  }

  function resetView(): void {
    placeDefaultView();
    fitView(false);
  }

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    fitView(true);
  }

  function labelPositions(): LabelPosition[] {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    return labelLines.map(({ id, line, to }) => {
      const projected = line.localToWorld(to.clone()).project(camera);
      return {
        id,
        x: ((projected.x + 1) / 2) * width,
        y: ((1 - projected.y) / 2) * height,
      };
    });
  }

  function renderFrame(): void {
    requestAnimationFrame(renderFrame);
    if (fitted === null) {
      // 描画領域がまだ大きさを持たない間は，画角を決められない．
      return;
    }
    const hasMoved = controls.update();
    if (!needsRender && !hasMoved) {
      return;
    }
    needsRender = false;
    renderer.render(scene, camera);
    options.onRender(labelPositions(), labelOpacity(factor));
  }

  function setEmissive(id: PartId | null, intensity: number): void {
    if (id === null) {
      return;
    }
    for (const material of materialsByPart.get(id) ?? []) {
      material.emissive.setHex(HIGHLIGHT_COLOR);
      material.emissiveIntensity = intensity;
    }
  }

  applyFactor();
  placeDefaultView();
  resize();
  // 呼び出し側が番号ラベルなどを用意し終えてから，最初の描画を行う．
  requestAnimationFrame(renderFrame);

  return {
    setFactor(value) {
      const next = clampFactor(value);
      if (next === factor) {
        return;
      }
      factor = next;
      applyFactor();
      fitView(false);
    },
    setHighlight(id) {
      if (id === highlighted) {
        return;
      }
      setEmissive(highlighted, 0);
      setEmissive(id, HIGHLIGHT_INTENSITY);
      highlighted = id;
      needsRender = true;
    },
    setLineColor(color) {
      lineMaterial.color.set(color);
      needsRender = true;
    },
    pick(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const pointer = new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        1 - ((clientY - rect.top) / rect.height) * 2,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pickables, false)[0];
      const partId: unknown = hit?.object.userData.partId;
      return isPartId(partId) ? partId : null;
    },
    orbitBy(horizontal, vertical) {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new Spherical().setFromVector3(offset);
      spherical.theta += horizontal;
      spherical.phi = Math.min(
        controls.maxPolarAngle,
        Math.max(controls.minPolarAngle, spherical.phi + vertical),
      );
      camera.position
        .copy(controls.target)
        .add(offset.setFromSpherical(spherical));
      controls.update();
      needsRender = true;
    },
    zoomBy(scale) {
      const offset = camera.position.clone().sub(controls.target);
      const distance = Math.min(
        controls.maxDistance,
        Math.max(controls.minDistance, offset.length() * scale),
      );
      camera.position.copy(controls.target).add(offset.setLength(distance));
      controls.update();
      needsRender = true;
    },
    setPortrait(portrait) {
      if (portrait === isPortrait) {
        return;
      }
      isPortrait = portrait;
      resetView();
    },
    resetView,
    resize,
  };
}
