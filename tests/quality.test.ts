import { describe, expect, test } from "vitest";
import { DEFAULT_QUALITY, parseQualityOptions } from "../src/view/quality";

describe("parseQualityOptions", () => {
  test("指定がなければ既定の設定を返す", () => {
    expect(parseQualityOptions("")).toEqual(DEFAULT_QUALITY);
    expect(parseQualityOptions("?unrelated=1")).toEqual(DEFAULT_QUALITY);
  });

  test("aa=off でアンチエイリアスを切る", () => {
    expect(parseQualityOptions("?aa=off").antialias).toBe(false);
  });

  test("blur=off で背景ぼかしを切る", () => {
    expect(parseQualityOptions("?blur=off").usesBackdropBlur).toBe(false);
  });

  test("fps=on で描画の速さを表示する", () => {
    expect(parseQualityOptions("?fps=on").showsFrameStats).toBe(true);
  });

  test("dpr でデバイスピクセル比の上限を変える", () => {
    expect(parseQualityOptions("?dpr=1").maxPixelRatio).toBe(1);
    expect(parseQualityOptions("?dpr=0.75").maxPixelRatio).toBe(0.75);
  });

  test("複数の指定を同時に受け付ける", () => {
    expect(parseQualityOptions("?fps=on&aa=off&dpr=1&blur=off")).toEqual({
      antialias: false,
      maxPixelRatio: 1,
      usesBackdropBlur: false,
      showsFrameStats: true,
    });
  });

  test.each([
    { value: "on" },
    { value: "" },
    { value: "0" },
    { value: "OFF " },
  ])("aa=$value は off ではないため，既定のままにする", ({ value }) => {
    expect(parseQualityOptions(`?aa=${value}`).antialias).toBe(true);
  });

  test.each([
    { value: "abc" },
    { value: "" },
    { value: "NaN" },
    { value: "Infinity" },
  ])("dpr=$value は数値として読めないため，既定のままにする", ({ value }) => {
    expect(parseQualityOptions(`?dpr=${value}`).maxPixelRatio).toBe(
      DEFAULT_QUALITY.maxPixelRatio,
    );
  });

  test("dpr は 0.5 から 2 の範囲へ収める", () => {
    expect(parseQualityOptions("?dpr=0.1").maxPixelRatio).toBe(0.5);
    expect(parseQualityOptions("?dpr=8").maxPixelRatio).toBe(2);
    expect(parseQualityOptions("?dpr=-1").maxPixelRatio).toBe(0.5);
  });
});
