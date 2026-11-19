/** 描画の品質と診断の設定．URL のクエリで上書きできる． */
export interface QualityOptions {
  /** アンチエイリアス（MSAA）を使うかどうか． */
  readonly antialias: boolean;
  /** 描画に使うデバイスピクセル比の上限． */
  readonly maxPixelRatio: number;
  /** 解説欄の背景ぼかしを使うかどうか． */
  readonly usesBackdropBlur: boolean;
  /** 描画の速さを画面へ表示するかどうか． */
  readonly showsFrameStats: boolean;
}

export const DEFAULT_QUALITY: QualityOptions = {
  antialias: true,
  maxPixelRatio: 2,
  usesBackdropBlur: true,
  showsFrameStats: false,
};

const MIN_PIXEL_RATIO = 0.5;
const MAX_PIXEL_RATIO = 2;

/** dpr の指定を読む．数値として読めなければ既定の上限を返す． */
function parsePixelRatio(value: string | null): number {
  // 空文字は Number で 0 になるため，数値の指定がないものとして扱う．
  if (value === null || value.trim() === "") {
    return DEFAULT_QUALITY.maxPixelRatio;
  }
  const ratio = Number(value);
  if (!Number.isFinite(ratio)) {
    return DEFAULT_QUALITY.maxPixelRatio;
  }
  return Math.min(MAX_PIXEL_RATIO, Math.max(MIN_PIXEL_RATIO, ratio));
}

/**
 * URL のクエリから，描画の設定を読む．
 * 実機で重さの原因を切り分けるための指定であり，通常の利用では既定のままになる．
 *
 * - `aa=off`: アンチエイリアスを切る．
 * - `blur=off`: 解説欄の背景ぼかしを切る．
 * - `dpr=1`: デバイスピクセル比の上限を変える．
 * - `fps=on`: 描画の速さを画面へ表示する．
 */
export function parseQualityOptions(search: string): QualityOptions {
  const params = new URLSearchParams(search);
  return {
    antialias: params.get("aa") !== "off",
    maxPixelRatio: parsePixelRatio(params.get("dpr")),
    usesBackdropBlur: params.get("blur") !== "off",
    showsFrameStats: params.get("fps") === "on",
  };
}
