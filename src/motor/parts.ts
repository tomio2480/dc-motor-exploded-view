export const PART_IDS = [
  "bearing",
  "case",
  "magnets",
  "shaft",
  "core",
  "windings",
  "commutator",
  "brushes",
  "terminals",
  "endBell",
] as const;

export type PartId = (typeof PART_IDS)[number];

export interface PartInfo {
  readonly id: PartId;
  /** 図中の番号．1 から始まる． */
  readonly number: number;
  readonly name: string;
  /** 部品名の読み． */
  readonly kana: string;
  /** 一言で表した役割． */
  readonly role: string;
  readonly description: string;
}

/** 図中の番号順（モーターの先端側から後端側）に並べた部品の一覧． */
export const PARTS: readonly PartInfo[] = [
  {
    id: "bearing",
    number: 1,
    name: "軸受",
    kana: "じくうけ",
    role: "シャフトを支えて滑らかに回す",
    description:
      "ケースの先端にはめ込まれた筒状の部品．油を含ませた焼結金属で作られ，回転するシャフトとの摩擦を減らす．後ろ側はエンドベルの穴が同じ役割を担う．",
  },
  {
    id: "case",
    number: 2,
    name: "モーターケース",
    kana: "もーたーけーす",
    role: "部品を収め，磁力の通り道になる",
    description:
      "鉄板を絞って作った外側の容器．内側に永久磁石を固定する．磁石の磁力線を外へ漏らさずに通す役割もあり，ヨークとも呼ばれる．",
  },
  {
    id: "magnets",
    number: 3,
    name: "永久磁石",
    kana: "えいきゅうじしゃく",
    role: "回転に必要な磁界をつくる",
    description:
      "ケースの内側に向かい合わせで置かれた 2 個の磁石．N 極と S 極が電機子を挟み，一定の向きの磁界をつくる．実物は黒に近い灰色で，図では N 極を赤，S 極を青で示す．",
  },
  {
    id: "shaft",
    number: 4,
    name: "シャフト",
    kana: "しゃふと",
    role: "回転を外へ取り出す軸",
    description:
      "電機子の中心を貫く鋼の軸．鉄心と整流子が固定されており，一体で回る．ケースから出た先端に歯車やプロペラを取り付けて使う．",
  },
  {
    id: "core",
    number: 5,
    name: "電機子鉄心",
    kana: "でんきしてっしん",
    role: "巻線がつくる磁力を強める",
    description:
      "薄い鉄板を重ねて作った，3 本の突起を持つ芯．巻線に電流が流れると電磁石になる．永久磁石と引き合い，反発し合うことで回転する力が生まれる．",
  },
  {
    id: "windings",
    number: 6,
    name: "巻線",
    kana: "まきせん",
    role: "電流を流して電磁石にする",
    description:
      "鉄心の突起に巻いたエナメル線．コイルとも呼ぶ．両端は両隣の整流子の銅片へつながる．流れる電流の向きに応じて，突起の先が N 極または S 極になる．",
  },
  {
    id: "commutator",
    number: 7,
    name: "整流子",
    kana: "せいりゅうし",
    role: "電流の向きを切り替える",
    description:
      "シャフトに固定された 3 枚の銅片．回転に合わせてブラシと触れる銅片が入れ替わり，巻線に流れる電流の向きが切り替わる．これにより同じ向きに回り続ける．",
  },
  {
    id: "brushes",
    number: 8,
    name: "ブラシ",
    kana: "ぶらし",
    role: "回る整流子へ電気を伝える",
    description:
      "整流子に軽く押し当てられた 2 枚の金属板．ばねの性質で整流子と擦れ合いながら電流を流し，使い続けるとすり減る．高出力の型では，板の先に付けたカーボンの小片が触れる．",
  },
  {
    id: "terminals",
    number: 9,
    name: "端子",
    kana: "たんし",
    role: "電源をつなぐ接続口",
    description:
      "エンドベルから外へ突き出た 2 本の金属板．電池などの電源をここへつなぐ．ブラシと一続きになっている．つなぐ向きを逆にするとモーターは逆に回る．",
  },
  {
    id: "endBell",
    number: 10,
    name: "エンドベル",
    kana: "えんどべる",
    role: "後ろ側のふたと土台",
    description:
      "ケースの後ろをふさぐ樹脂製のふた．ブラシと端子を支え，電気を通さない材質で 2 本の端子を絶縁する．中央の穴はシャフトの後端を支える．",
  },
];

export function isPartId(value: unknown): value is PartId {
  return PART_IDS.some((id) => id === value);
}

export function getPart(id: PartId): PartInfo {
  const part = PARTS.find((candidate) => candidate.id === id);
  if (part === undefined) {
    throw new Error(`部品カタログに定義がない: ${id}`);
  }
  return part;
}
