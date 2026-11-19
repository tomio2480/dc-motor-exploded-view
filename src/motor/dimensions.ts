/**
 * 130 型相当のブラシ付き DC モーターの寸法の目安．単位は mm．
 * 特定の製品の図面ではなく，一般的な構造を示すための概略値である．
 * 軸方向を x とし，出力軸の側を正とする．ケースの中央を原点に置く．
 */
const DEGREE = Math.PI / 180;

export const CASE = {
  radius: 10.05,
  /** 中心から平面までの距離．平面は z = ±flatHalf にある． */
  flatHalf: 7.55,
  wall: 0.6,
  rearX: -12.5,
  frontX: 12.5,
  bossRadius: 3.1,
  bossLength: 1.6,
} as const;

export const BEARING = {
  outerRadius: 2.0,
  rearX: 11.5,
  frontX: 14.1,
} as const;

export const SHAFT = {
  radius: 1.0,
  rearX: -17.5,
  frontX: 22.5,
} as const;

export const MAGNET = {
  innerRadius: 6.9,
  outerRadius: 9.35,
  halfSpan: 45 * DEGREE,
  rearX: -5.0,
  frontX: 10.0,
} as const;

export const CORE = {
  poleCount: 3,
  hubRadius: 2.6,
  stemHalfWidth: 1.3,
  headInnerRadius: 5.0,
  headOuterRadius: 6.5,
  headHalfSpan: 46 * DEGREE,
  /** 最初の突起が向く角度．y 軸の正の向きを 0 とし，z 軸の正の向きへ回る． */
  startAngle: 90 * DEGREE,
  rearX: -3.5,
  frontX: 7.5,
  laminationCount: 14,
  /** 鉄板どうしの間に見せるすき間． */
  laminationGap: 0.08,
} as const;

export const WINDING = {
  innerRadius: 2.9,
  outerRadius: 4.8,
  /** 柱の側面からの巻きの厚み． */
  thickness: 1.9,
  layerCount: 5,
  /** 整流子へつなぐ引き出し線の半径． */
  leadRadius: 0.2,
  /** 引き出し線が巻線から出る位置の，突起の中心からの接線方向の距離． */
  leadOffset: 2.2,
} as const;

export const COMMUTATOR = {
  hubRadius: 1.9,
  outerRadius: 2.7,
  segmentCount: 3,
  segmentHalfSpan: 52 * DEGREE,
  rearX: -11.0,
  frontX: -6.5,
  /** 絶縁体の筒が銅片より前後へはみ出す長さ． */
  hubOverhang: 0.2,
  /** 巻線の引き出し線をつなぐ突起の，軸からの高さ． */
  tabOuterRadius: 3.4,
  /** 突起の接線方向の幅． */
  tabWidth: 0.9,
  /** 突起の軸方向の長さ．銅片の前端から後ろへ伸びる． */
  tabLength: 0.6,
} as const;

export const BRUSH = {
  thickness: 0.25,
  widthX: 2.0,
  centerX: -8.8,
  /** 整流子に触れる位置から端子までの z 方向の長さ． */
  reach: 6.0,
  /** 整流子を越えて伸びる先端の長さ． */
  tipOverrun: 1.5,
} as const;

export const TERMINAL = {
  thickness: 0.4,
  widthY: 2.6,
  frontX: -7.8,
  rearX: -23.0,
  holeRadius: 0.6,
  /** 後端から穴の中心までの距離． */
  holeInset: 1.8,
} as const;

export const END_BELL = {
  rearX: -17.5,
  frontX: -12.5,
  /** ケースの内側へはまる縁の長さ． */
  lipLength: 1.2,
  lipThickness: 1.2,
  /** ケースの内壁と縁のすき間． */
  lipClearance: 0.05,
  bossRadius: 3.0,
  bossLength: 1.5,
  /** 端子を通す溝が端子より広い分の片側の余裕． */
  slotClearance: 0.1,
} as const;
