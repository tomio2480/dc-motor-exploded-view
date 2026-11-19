/**
 * 回転子の角度から，ブラシと整流子の接触，巻線の電流，回転力を求める．
 * 角度はラジアンで，モデルの y 軸の正の向きを 0 とし，z 軸の正の向きへ増える．
 */

import { COMMUTATOR, CORE } from "./dimensions";

/** 電源のつなぎ方．1 は上側のブラシが正極，-1 は下側のブラシが正極． */
export type Polarity = 1 | -1;

/** 銅片が触れているブラシ．上下どちらにも触れていなければ none． */
export type BrushContact = "upper" | "lower" | "none";

const FULL_TURN = 2 * Math.PI;
const POLE_STEP = FULL_TURN / CORE.poleCount;
const SEGMENT_STEP = FULL_TURN / COMMUTATOR.segmentCount;
/** 上のブラシと下のブラシが整流子へ触れる角度． */
const BRUSH_ANGLES = { upper: 0, lower: Math.PI } as const;
/** ブラシの電位．正極を 1，負極を 0 とし，どちらにも触れない銅片は中間になる． */
const FLOATING_VOLTAGE = 0.5;

/** 角度を 0 以上 1 回転未満へそろえる． */
function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) {
    throw new RangeError(`角度が有限の数値ではない: ${angle}`);
  }
  return ((angle % FULL_TURN) + FULL_TURN) % FULL_TURN;
}

/** 突起（極）が向く角度． */
export function poleAngle(pole: number, rotorAngle = 0): number {
  return normalizeAngle(CORE.startAngle + rotorAngle + pole * POLE_STEP);
}

/**
 * 銅片の中心が向く角度．
 * 銅片は突起と突起の間にあり，銅片 n は突起 n と突起 n + 1 の間に位置する．
 * 切れ目が突起の向きと合うため，上下のブラシは別の銅片へ触れる．
 */
export function segmentAngle(segment: number, rotorAngle = 0): number {
  return normalizeAngle(poleAngle(segment, rotorAngle) + SEGMENT_STEP / 2);
}

/** 銅片の中心がブラシの角度から銅片の幅の半分以内にあれば，触れているとみなす． */
function touches(segmentCenter: number, brushAngle: number): boolean {
  const offset = normalizeAngle(segmentCenter - brushAngle + SEGMENT_STEP / 2);
  return offset < SEGMENT_STEP;
}

/** 銅片ごとに，触れているブラシを返す． */
export function segmentContacts(rotorAngle: number): BrushContact[] {
  return Array.from({ length: COMMUTATOR.segmentCount }, (_, segment) => {
    const center = segmentAngle(segment, rotorAngle);
    if (touches(center, BRUSH_ANGLES.upper)) {
      return "upper";
    }
    return touches(center, BRUSH_ANGLES.lower) ? "lower" : "none";
  });
}

function voltageOf(contact: BrushContact, polarity: Polarity): number {
  if (contact === "none") {
    return FLOATING_VOLTAGE;
  }
  const isPositive = (contact === "upper") === (polarity === 1);
  return isPositive ? 1 : 0;
}

/**
 * 極ごとの巻線に流れる電流を，最大を 1 とした比で返す．
 * 正の値は，突起の先が N 極になる向きを表す．
 * 巻線 n は銅片 n - 1 と銅片 n の間につながり，3 つの巻線が輪になる．
 */
export function coilCurrents(rotorAngle: number, polarity: Polarity): number[] {
  const voltages = segmentContacts(rotorAngle).map((contact) =>
    voltageOf(contact, polarity),
  );
  return Array.from({ length: CORE.poleCount }, (_, pole) => {
    const before = voltages.at(pole - 1) ?? FLOATING_VOLTAGE;
    const after = voltages[pole] ?? FLOATING_VOLTAGE;
    return before - after;
  });
}

/**
 * 極ごとの回転力を，最大を 1 とした比で返す．
 * 正の値は，角度が増える向きへ回す力を表す．
 * 上の永久磁石は内側が N 極，下は S 極であり，突起の極との引き合いと反発で力が生じる．
 */
export function torqueFactors(
  rotorAngle: number,
  polarity: Polarity,
): number[] {
  return coilCurrents(rotorAngle, polarity).map(
    // 負の値に 0 を掛けた結果の -0 を，0 を足して 0 へそろえる．
    (current, pole) => current * Math.sin(poleAngle(pole, rotorAngle)) + 0,
  );
}
