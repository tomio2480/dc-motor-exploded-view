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
import { fitDistance, viewBasis } from "./cameraFit";
import { smoothingFactor } from "./ease";
import { createFrameMeter } from "./frameMeter";
import {
  createMechanismOverlay,
  type MarkerTone,
  type MechanismView,
} from "./mechanismOverlay";
import type { QualityOptions } from "./quality";
import { clampFactor, explodedOffset, labelOpacity } from "./explode";

/** 番号ラベルを置く画面上の位置．描画領域の左上を原点とする CSS ピクセル． */
export interface LabelPosition {
  readonly id: PartId;
  readonly x: number;
  readonly y: number;
}

/** 3D 上の位置へ重ねる記号の，画面上の位置と内容． */
export interface MarkerPosition {
  readonly id: string;
  readonly text: string;
  readonly tone: MarkerTone;
  readonly isVisible: boolean;
  readonly x: number;
  readonly y: number;
}

/** 表示の種類．parts は部品の展開図，mechanism は回るしくみの説明． */
export type ViewMode = "parts" | "mechanism";

/** 描画のたびに，HTML の重ね表示へ渡す内容． */
export interface RenderInfo {
  readonly labels: readonly LabelPosition[];
  /** 番号ラベルの不透明度． */
  readonly labelOpacity: number;
  /** 回るしくみの記号．展開図の表示では空になる． */
  readonly markers: readonly MarkerPosition[];
  readonly frame: FrameStats;
}

/** 描画の速さと，描画先の大きさ．重さの原因を切り分けるために使う． */
export interface FrameStats {
  /** 直近の連続した描画での，フレーム間隔の中央値（ミリ秒）．測れていなければ null． */
  readonly intervalMs: number | null;
  /** 描画先の横と縦の画素数． */
  readonly width: number;
  readonly height: number;
  /** 実際にアンチエイリアスが有効かどうか． */
  readonly antialias: boolean;
}

export interface MotorSceneOptions {
  readonly reducedMotion: boolean;
  /** 縦長の画面かどうか．縦長ではモーターの軸を縦へ向ける． */
  readonly portrait: boolean;
  /** 引き出し線の色．CSS の色表記で渡す． */
  readonly lineColor: string;
  readonly quality: QualityOptions;
  /** 描画のたびに，番号ラベルと記号の位置を受け取る． */
  readonly onRender: (info: RenderInfo) => void;
}

export interface MotorScene {
  setFactor(factor: number): void;
  /** 展開図の表示と，回るしくみの表示を切り替える． */
  setMode(mode: ViewMode): void;
  /** 回るしくみの表示で，回転子の角度と，電流・極・力の示し方を変える． */
  setMechanism(view: MechanismView): void;
  setHighlight(id: PartId | null): void;
  /** 指定した部品へ寄って表示する．null を渡すと全体の表示へ戻す． */
  setFocus(id: PartId | null): void;
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
/** 部品へ寄るときの余白の倍率．周りの部品も見えるよう広めに取る． */
const FOCUS_MARGIN = 1.9;
/** 視点を滑らかに移すときの時定数（ミリ秒）． */
const VIEW_EASE_MS = 140;
/** 目標との差がこの割合を下回ったら，視点の移動を終える． */
const VIEW_SETTLE_RATIO = 0.002;
/** 描画の速さを求めるのに使うフレーム間隔の数． */
const FRAME_METER_WINDOW = 30;
/**
 * これより長いフレーム間隔は，描画を止めていた時間とみなす（ミリ秒）．
 * 最初の描画の直後を除き，続けて描画した間隔は，この値によらず数える．
 */
const FRAME_METER_MAX_GAP_MS = 1000;
const TONE_EXPOSURE = 0.95;
const ENVIRONMENT_INTENSITY = 0.7;
const KEY_LIGHT_INTENSITY = 1.1;
/**
 * 注目中の部品を光らせる強さ．部品そのものの色で光らせ，色合いを変えない．
 * 永久磁石の赤と青のように，色が意味を持つ部品の区別を保つためである．
 */
const HIGHLIGHT_INTENSITY = 0.6;
/** 画角合わせで決めた距離に対する，拡大と縮小の限度． */
const ZOOM_IN_LIMIT = 0.05;
const ZOOM_OUT_LIMIT = 2.5;
/** 真上と真下を避けるための，垂直方向の角度の余裕． */
const POLAR_MARGIN = 0.05;

/**
 * 回るしくみの表示での画角．
 * 手前へ伸びる端子が遠近法で大きく写らないよう，遠くから狭い画角で見る．
 */
const MECHANISM_FOV_DEGREES = 7;
/**
 * 回るしくみの表示で，注視点からカメラへ向かう方向．
 * 整流子の側から軸に沿って，少し上から見る．
 * 左右へは振らず，板状の端子を薄い側から見て，回転子を隠さないようにする．
 */
const MECHANISM_VIEW: Vec3 = [-1, 0.3, 0];
/** 回転子として一体で回る部品． */
const ROTOR_PART_IDS: ReadonlySet<PartId> = new Set([
  "shaft",
  "core",
  "windings",
  "commutator",
]);
/** 回るしくみの表示では，中が見えるよう外側の部品を隠す． */
const HIDDEN_IN_MECHANISM: ReadonlySet<PartId> = new Set([
  "bearing",
  "case",
  "endBell",
]);
const INITIAL_MECHANISM_VIEW: MechanismView = {
  rotorAngle: 0,
  polarity: 1,
  currentReach: "none",
  showsPoles: false,
  showsForces: false,
};

/** 横長の画面で，注視点からカメラへ向かう方向． */
const LANDSCAPE_VIEW: Vec3 = [0.5, 0.36, 1];
/** 縦長の画面で，注視点からカメラへ向かう方向． */
const PORTRAIT_VIEW: Vec3 = [0.42, 0.16, 1];

interface Piece {
  readonly id: PartId;
  readonly object: Object3D;
  readonly offset: Vec3;
  readonly bounds: Box3;
}

/** カメラの置き方．注視点と，注視点からカメラまでの距離で表す． */
interface ViewPose {
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
  const { quality } = options;
  const renderer = new WebGLRenderer({
    canvas,
    antialias: quality.antialias,
    alpha: true,
  });
  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, quality.maxPixelRatio),
  );
  const frameMeter = createFrameMeter(
    FRAME_METER_WINDOW,
    FRAME_METER_MAX_GAP_MS,
  );
  /** 描画先の画素数を受け取る入れ物．描画のたびに作り直さないよう使い回す． */
  const bufferSize = new Vector2();
  // 指定どおりにならない環境もあるため，実際の設定を問い合わせる．
  const hasAntialias =
    renderer.getContext().getContextAttributes()?.antialias === true;
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
  // 利用者が視点を動かし始めたら，自動の視点移動をやめる．
  controls.addEventListener("start", () => {
    goal = null;
  });
  // OrbitControls は入力の処理の中でも視点を更新する．
  // 描画ループでの update() の戻り値だけでは，その変化を取りこぼす．
  controls.addEventListener("change", () => {
    needsRender = true;
  });

  // 縦長の画面では軸を縦へ向けるため，モデル全体をこのグループごと回す．
  const root = new Group();
  scene.add(root);
  // 回転子の部品は，回るしくみの表示で一体として回すためにまとめる．
  const rotor = new Group();
  root.add(rotor);

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
      (ROTOR_PART_IDS.has(id) ? rotor : root).add(object);
      pieces.push({
        id,
        object,
        offset,
        bounds: new Box3().setFromObject(object),
      });
      object.traverse((child) => {
        if (child instanceof Mesh) {
          pickables.push(child);
        }
      });
    });
  }

  const overlay = createMechanismOverlay(parts);
  rotor.add(overlay.rotorObjects);
  root.add(overlay.fixedObjects);

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
  /** 寄って表示している部品．全体を表示しているときは null． */
  let focus: PartId | null = null;
  /** 画角合わせで決めた視点．利用者による拡大と移動の基準にする． */
  let fitted: ViewPose | null = null;
  /** 滑らかに移している途中の，視点の行き先． */
  let goal: ViewPose | null = null;
  let lastFrameTime: number | null = null;
  let mode: ViewMode = "parts";
  let mechanismView = INITIAL_MECHANISM_VIEW;
  let highlighted: PartId | null = null;
  let needsRender = true;
  /** 直前のフレームで描画したか．描画の速さを測るときに，止めていた時間と区別する． */
  let renderedLastFrame = false;
  const raycaster = new Raycaster();

  /** 回るしくみの表示では，利用者が選んだ展開度によらず組立状態で示す． */
  function shownFactor(): number {
    return mode === "mechanism" ? 0 : factor;
  }

  function applyFactor(): void {
    for (const piece of pieces) {
      piece.object.position.set(...explodedOffset(piece.offset, shownFactor()));
    }
    const opacity = labelOpacity(shownFactor());
    lineMaterial.opacity = opacity;
    for (const labelLine of labelLines) {
      labelLine.line.position.set(
        ...explodedOffset(labelLine.offset, shownFactor()),
      );
      labelLine.line.visible = opacity > 0;
    }
  }

  /**
   * 画角へ収める対象の点を，ワールド座標で返す．
   * only を渡すと，その部品と引き出し線だけを対象にする．
   */
  function framePoints(only: PartId | null): Vector3[] {
    root.updateMatrixWorld(true);
    const isIncluded = (id: PartId): boolean => only === null || only === id;
    const points: Vector3[] = [];
    const isShown = (piece: Piece): boolean =>
      piece.object.visible && isIncluded(piece.id);
    for (const piece of pieces.filter(isShown)) {
      const shift = new Vector3(...explodedOffset(piece.offset, shownFactor()));
      for (const corner of boxCorners(piece.bounds)) {
        points.push(corner.add(shift));
      }
    }
    // ラベルの現れ方に合わせて引き出し線の先端を含め，画角の急な変化を避ける．
    const opacity = labelOpacity(shownFactor());
    const framedLines = mode === "parts" ? labelLines : [];
    for (const labelLine of framedLines.filter(({ id }) => isIncluded(id))) {
      const shift = new Vector3(
        ...explodedOffset(labelLine.offset, shownFactor()),
      );
      points.push(
        labelLine.from.clone().lerp(labelLine.to, opacity).add(shift),
      );
    }
    return points.map((point) => root.localToWorld(point));
  }

  /** 点群の中心を注視点とし，すべての点が収まる距離を求める． */
  function measureFit(
    points: Vector3[],
    direction: Vector3,
    margin: number,
  ): ViewPose {
    const target = new Box3().setFromPoints(points).getCenter(new Vector3());
    const distance =
      margin *
      fitDistance(
        points.map((point) => point.sub(target).toArray()),
        viewBasis(direction.toArray()),
        (camera.fov * Math.PI) / 180,
        camera.aspect,
      );
    return { target, distance };
  }

  function applyPose(pose: ViewPose, direction: Vector3): void {
    controls.target.copy(pose.target);
    camera.position.copy(pose.target).addScaledVector(direction, pose.distance);
    controls.update();
    needsRender = true;
  }

  /**
   * 現在の視線の向きを保ったまま，全体または寄っている部品が収まる視点を決める．
   * keepUserView が真なら，利用者が変えた拡大率と注視点のずれを引き継ぐ．
   * animate が真なら，その視点へ滑らかに移す．
   */
  function fitView(keepUserView: boolean, animate: boolean): void {
    const offset = camera.position.clone().sub(controls.target);
    const direction = offset.clone().normalize();
    const previous = keepUserView ? fitted : null;
    const zoom = previous === null ? 1 : offset.length() / previous.distance;
    const pan =
      previous === null
        ? new Vector3()
        : controls.target.clone().sub(previous.target);

    const overview = measureFit(framePoints(null), direction, FIT_MARGIN);
    fitted =
      focus === null
        ? overview
        : measureFit(framePoints(focus), direction, FOCUS_MARGIN);
    // 拡大と縮小の限度は，寄っているかどうかによらず全体の表示を基準にする．
    controls.minDistance = overview.distance * ZOOM_IN_LIMIT;
    controls.maxDistance = overview.distance * ZOOM_OUT_LIMIT;
    camera.near = overview.distance / 200;
    camera.far = overview.distance * 10;
    camera.updateProjectionMatrix();

    const pose = {
      target: fitted.target.clone().add(pan),
      distance: fitted.distance * zoom,
    };
    if (animate && !options.reducedMotion) {
      goal = pose;
      needsRender = true;
      return;
    }
    goal = null;
    applyPose(pose, direction);
  }

  /** 視点を行き先へ近づける．十分に近づいたら移動を終える． */
  function advanceGoal(elapsedMs: number): void {
    if (goal === null) {
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    const ratio = smoothingFactor(elapsedMs, VIEW_EASE_MS);
    const target = controls.target.clone().lerp(goal.target, ratio);
    const distance =
      offset.length() + (goal.distance - offset.length()) * ratio;
    const tolerance = goal.distance * VIEW_SETTLE_RATIO;
    const isSettled =
      Math.abs(goal.distance - distance) < tolerance &&
      target.distanceTo(goal.target) < tolerance;
    applyPose(isSettled ? goal : { target, distance }, offset.normalize());
    if (isSettled) {
      goal = null;
    }
  }

  /** モデルとカメラを，画面の向きに応じた初期の向きへ置く． */
  function placeDefaultView(): void {
    controls.target.set(0, 0, 0);
    if (mode === "mechanism") {
      // 軸に沿って見る表示は縦横どちらの画面にも収まるため，モデルを回さない．
      root.rotation.z = 0;
      camera.fov = MECHANISM_FOV_DEGREES;
      camera.position.set(...MECHANISM_VIEW);
      return;
    }
    camera.fov = FOV_DEGREES;
    root.rotation.z = isPortrait ? Math.PI / 2 : 0;
    camera.position.set(...(isPortrait ? PORTRAIT_VIEW : LANDSCAPE_VIEW));
  }

  function resetView(): void {
    placeDefaultView();
    fitView(false, false);
  }

  function resize(): void {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    if (goal === null) {
      fitView(true, false);
    } else {
      // 視点を移している途中なら，新しい大きさでの行き先へ向け直す．
      fitView(false, true);
    }
  }

  function labelPositions(): LabelPosition[] {
    return labelLines.map(({ id, line, to }) => ({
      id,
      ...projectToCanvas(line.localToWorld(to.clone())),
    }));
  }

  function projectToCanvas(worldPoint: Vector3): { x: number; y: number } {
    const projected = worldPoint.project(camera);
    return {
      x: ((projected.x + 1) / 2) * canvas.clientWidth,
      y: ((1 - projected.y) / 2) * canvas.clientHeight,
    };
  }

  function markerPositions(): MarkerPosition[] {
    if (mode !== "mechanism") {
      return [];
    }
    return overlay.markers(mechanismView).map((anchor) => ({
      id: anchor.id,
      text: anchor.text,
      tone: anchor.tone,
      isVisible: anchor.isVisible,
      ...projectToCanvas(root.localToWorld(anchor.position)),
    }));
  }

  function renderFrame(time: number): void {
    requestAnimationFrame(renderFrame);
    const elapsedMs = lastFrameTime === null ? 0 : time - lastFrameTime;
    lastFrameTime = time;
    const followsRender = renderedLastFrame;
    renderedLastFrame = false;
    if (fitted === null) {
      // 描画領域がまだ大きさを持たない間は，画角を決められない．
      return;
    }
    advanceGoal(elapsedMs);
    // 減衰の途中の動きを進める．視点が変われば change の通知が描画を求める．
    controls.update();
    if (!needsRender) {
      return;
    }
    needsRender = false;
    renderer.render(scene, camera);
    renderedLastFrame = true;
    // 描画の遅い環境でも測れるよう，続けて描画したかを計器へ渡す．
    frameMeter.record(time, followsRender);
    renderer.getDrawingBufferSize(bufferSize);
    options.onRender({
      frame: {
        intervalMs: frameMeter.typicalIntervalMs(),
        width: bufferSize.x,
        height: bufferSize.y,
        antialias: hasAntialias,
      },
      labels: labelPositions(),
      labelOpacity: labelOpacity(shownFactor()),
      markers: markerPositions(),
    });
  }

  function setEmissive(id: PartId | null, intensity: number): void {
    if (id === null) {
      return;
    }
    for (const material of materialsByPart.get(id) ?? []) {
      material.emissive.copy(material.color);
      material.emissiveIntensity = intensity;
    }
  }

  // ページを隠すと rAF も止まる．戻った直後の間隔は隠していた時間を含むため，続けた描画とみなさない．
  // 隠れている間に rAF が呼ばれた場合にも備え，隠れたときと見えるようになったときの両方で戻す．
  document.addEventListener("visibilitychange", () => {
    renderedLastFrame = false;
  });

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
      fitView(false, false);
    },
    setMode(next) {
      if (next === mode) {
        return;
      }
      mode = next;
      const isMechanism = mode === "mechanism";
      for (const piece of pieces) {
        piece.object.visible =
          !isMechanism || !HIDDEN_IN_MECHANISM.has(piece.id);
      }
      setEmissive(highlighted, 0);
      highlighted = null;
      focus = null;
      overlay.setActive(isMechanism);
      if (isMechanism) {
        overlay.update(mechanismView);
      }
      rotor.rotation.x = isMechanism ? mechanismView.rotorAngle : 0;
      applyFactor();
      resetView();
    },
    setMechanism(view) {
      mechanismView = view;
      if (mode !== "mechanism") {
        return;
      }
      overlay.update(view);
      rotor.rotation.x = view.rotorAngle;
      needsRender = true;
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
    setFocus(id) {
      if (id === focus) {
        return;
      }
      focus = id;
      fitView(false, true);
    },
    setLineColor(color) {
      lineMaterial.color.set(color);
      needsRender = true;
    },
    pick(clientX, clientY) {
      if (mode === "mechanism") {
        // 回るしくみの表示では，部品の解説を出さない．
        return null;
      }
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
      // 自動の視点移動が距離を上書きしないよう，利用者の操作を優先する．
      goal = null;
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
