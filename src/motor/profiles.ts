/** 断面上の点．u・v の順に並べる．単位は mm． */
export type Point2 = readonly [number, number];

export interface RingSector {
  readonly innerRadius: number;
  readonly outerRadius: number;
  /** 扇の中心が向く角度（ラジアン）． */
  readonly centerAngle: number;
  /** 中心から片側への開き角（ラジアン）． */
  readonly halfSpan: number;
  /** 円弧 1 本あたりの分割数． */
  readonly segments: number;
}

export interface ArmatureShape {
  readonly poleCount: number;
  readonly hubRadius: number;
  /** 突起の柱の幅の半分． */
  readonly stemHalfWidth: number;
  readonly headInnerRadius: number;
  readonly headOuterRadius: number;
  /** 突起の先端が広がる角度の半分（ラジアン）． */
  readonly headHalfSpan: number;
  /** 最初の突起が向く角度（ラジアン）． */
  readonly startAngle: number;
  readonly segments: number;
}

/** 分割数を，中央の角度を必ず通る偶数へそろえる． */
function evenSegments(segments: number): number {
  if (!Number.isInteger(segments) || segments < 1) {
    throw new RangeError(`分割数が 1 以上の整数ではない: ${segments}`);
  }
  return 2 * Math.ceil(segments / 2);
}

/** 両端を含む円弧上の点を返す．終了角が開始角より小さければ時計回りになる． */
function arcPoints(
  radius: number,
  from: number,
  to: number,
  segments: number,
): Point2[] {
  const count = evenSegments(segments);
  const points: Point2[] = [];
  for (let index = 0; index <= count; index += 1) {
    const angle = from + ((to - from) * index) / count;
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return points;
}

/**
 * 円の上下を平面で切り落とした断面を，反時計回りの点列で返す．
 * 平面は v = ±flatHalf にあり，曲面は u 軸の正負の側に残る．
 */
export function flattedCircleProfile(
  radius: number,
  flatHalf: number,
  segments: number,
): Point2[] {
  if (!(radius > 0) || !(flatHalf > 0) || !(flatHalf < radius)) {
    throw new RangeError(
      `平面までの距離は 0 より大きく半径より小さい値にする: 半径 ${radius}，距離 ${flatHalf}`,
    );
  }
  const flatAngle = Math.asin(flatHalf / radius);
  return [
    ...arcPoints(radius, -flatAngle, flatAngle, segments),
    ...arcPoints(radius, Math.PI - flatAngle, Math.PI + flatAngle, segments),
  ];
}

/** 円環を扇形に切り出した断面を，反時計回りの点列で返す． */
export function ringSectorProfile(sector: RingSector): Point2[] {
  const { innerRadius, outerRadius, centerAngle, halfSpan, segments } = sector;
  if (!(innerRadius > 0) || !(innerRadius < outerRadius)) {
    throw new RangeError(
      `内径は 0 より大きく外径より小さい値にする: 内径 ${innerRadius}，外径 ${outerRadius}`,
    );
  }
  const from = centerAngle - halfSpan;
  const to = centerAngle + halfSpan;
  return [
    ...arcPoints(outerRadius, from, to, segments),
    ...arcPoints(innerRadius, to, from, segments),
  ];
}

/**
 * 電機子鉄心の断面を，反時計回りの点列で返す．
 * 中心のハブから柱が伸び，その先に円弧状の先端が付いた突起を極数ぶん並べる．
 */
export function armatureProfile(shape: ArmatureShape): Point2[] {
  const {
    poleCount,
    hubRadius,
    stemHalfWidth,
    headInnerRadius,
    headOuterRadius,
    headHalfSpan,
    startAngle,
    segments,
  } = shape;
  if (!Number.isInteger(poleCount) || poleCount < 2) {
    throw new RangeError(`極数が 2 以上の整数ではない: ${poleCount}`);
  }
  if (!(stemHalfWidth > 0) || !(stemHalfWidth < hubRadius)) {
    throw new RangeError(
      `柱の幅の半分は 0 より大きくハブの半径より小さい値にする: ${stemHalfWidth}`,
    );
  }
  if (!(hubRadius < headInnerRadius) || !(headInnerRadius < headOuterRadius)) {
    throw new RangeError("半径はハブ，突起の先端の内側，外側の順に大きくする");
  }
  const poleStep = (2 * Math.PI) / poleCount;
  const stemAngleAtHub = Math.asin(stemHalfWidth / hubRadius);
  const stemAngleAtHead = Math.asin(stemHalfWidth / headInnerRadius);
  if (!(headHalfSpan > stemAngleAtHead) || !(headHalfSpan < poleStep / 2)) {
    throw new RangeError(
      `突起の先端の開き角は柱より広く，隣の突起と重ならない値にする: ${headHalfSpan}`,
    );
  }

  const points: Point2[] = [];
  for (let pole = 0; pole < poleCount; pole += 1) {
    const center = startAngle + pole * poleStep;
    points.push(
      ...arcPoints(
        headInnerRadius,
        center - stemAngleAtHead,
        center - headHalfSpan,
        segments,
      ),
      ...arcPoints(
        headOuterRadius,
        center - headHalfSpan,
        center + headHalfSpan,
        segments,
      ),
      ...arcPoints(
        headInnerRadius,
        center + headHalfSpan,
        center + stemAngleAtHead,
        segments,
      ),
      ...arcPoints(
        hubRadius,
        center + stemAngleAtHub,
        center + poleStep - stemAngleAtHub,
        segments,
      ),
    );
  }
  return points;
}

/** 多角形の符号付き面積を返す．反時計回りなら正になる． */
export function signedArea(points: readonly Point2[]): number {
  let doubled = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length] as Point2;
    doubled += point[0] * next[1] - next[0] * point[1];
  });
  return doubled / 2;
}
