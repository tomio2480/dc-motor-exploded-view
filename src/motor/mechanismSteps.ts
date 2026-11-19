/** 電流が届いている範囲．brushes は端子とブラシまで，coils は整流子と巻線まで． */
export type CurrentReach = "none" | "brushes" | "coils";

/** 回るしくみを順に説明する 1 段階． */
export interface MechanismStep {
  readonly title: string;
  readonly description: string;
  readonly currentReach: CurrentReach;
  /** 突起と永久磁石の極を示すかどうか． */
  readonly showsPoles: boolean;
  /** 突起が受ける力を矢印で示すかどうか． */
  readonly showsForces: boolean;
  /** 回転子を自動で回す速さ（度/秒）．0 なら回さない． */
  readonly rotationSpeed: number;
}

/** 電源をつないでから回り続けるまでを，起こる順に並べた段階． */
export const MECHANISM_STEPS: readonly MechanismStep[] = [
  {
    title: "電源をつなぐ",
    description:
      "2 本の端子へ電池をつなぐと，＋の端子から－の端子へ電流が流れようとする．端子はブラシと一続きの金属板で，電流はまずブラシへ届く．",
    currentReach: "brushes",
    showsPoles: false,
    showsForces: false,
    rotationSpeed: 0,
  },
  {
    title: "整流子から巻線へ流れる",
    description:
      "ブラシは整流子の銅片に触れている．電流は＋側のブラシから銅片へ移り，引き出し線を通って巻線を流れ，別の銅片から－側のブラシへ戻る．",
    currentReach: "coils",
    showsPoles: false,
    showsForces: false,
    rotationSpeed: 0,
  },
  {
    title: "巻線が電磁石になる",
    description:
      "電流が流れた巻線は電磁石になり，鉄心の突起の先に N 極か S 極が現れる．どちらの極になるかは，巻線を流れる電流の向きで決まる．",
    currentReach: "coils",
    showsPoles: true,
    showsForces: false,
    rotationSpeed: 0,
  },
  {
    title: "磁石との力で回り出す",
    description:
      "突起の極は，永久磁石の同じ極とは反発し，違う極とは引き合う．3 本の突起が受ける力はどれも同じ回転の向きになり，回転子が回り出す．",
    currentReach: "coils",
    showsPoles: true,
    showsForces: true,
    rotationSpeed: 0,
  },
  {
    title: "整流子が電流を切り替える",
    description:
      "回転子が回ると，ブラシに触れる銅片が入れ替わる．突起が永久磁石の正面を通り過ぎるたびに巻線の電流が逆向きになり，突起の極も入れ替わる．",
    currentReach: "coils",
    showsPoles: true,
    showsForces: true,
    rotationSpeed: 40,
  },
  {
    title: "同じ向きに回り続ける",
    description:
      "極が入れ替わるため，突起は通り過ぎた磁石から押され，次の磁石へ引かれ続ける．この繰り返しで回り続ける．電源を逆につなぐと，極がすべて逆になり逆に回る．",
    currentReach: "coils",
    showsPoles: true,
    showsForces: true,
    rotationSpeed: 150,
  },
];
