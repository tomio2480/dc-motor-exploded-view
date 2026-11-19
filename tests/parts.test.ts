import { describe, expect, test } from "vitest";
import { getPart, isPartId, PART_IDS, PARTS } from "../src/motor/parts";

const ROLE_MAX_LENGTH = 30;
const DESCRIPTION_MAX_LENGTH = 130;

describe("部品カタログ", () => {
  test("すべての部品 ID を定義順に 1 件ずつ持つ", () => {
    expect(PARTS.map((part) => part.id)).toEqual([...PART_IDS]);
  });

  test("図中の番号は 1 からの連番である", () => {
    expect(PARTS.map((part) => part.number)).toEqual(
      PART_IDS.map((_, index) => index + 1),
    );
  });

  test.each(PART_IDS.map((id) => ({ id })))(
    "$id は名前・読み・役割・解説を持つ",
    ({ id }) => {
      const part = getPart(id);
      expect(part.name.trim()).not.toBe("");
      expect(part.kana).toMatch(/^[ぁ-んー・]+$/);
      expect(part.role.trim()).not.toBe("");
      expect(part.description.trim()).not.toBe("");
    },
  );

  test.each(PART_IDS.map((id) => ({ id })))(
    "$id の文章は吹き出しに収まる長さである",
    ({ id }) => {
      const part = getPart(id);
      expect(part.role.length).toBeLessThanOrEqual(ROLE_MAX_LENGTH);
      expect(part.description.length).toBeLessThanOrEqual(
        DESCRIPTION_MAX_LENGTH,
      );
    },
  );
});

describe("isPartId", () => {
  test("定義済みの ID を受け付ける", () => {
    expect(isPartId("commutator")).toBe(true);
  });

  test.each([
    { value: "unknown" },
    { value: "" },
    { value: 3 },
    { value: null },
    { value: undefined },
  ])("$value は部品 ID ではない", ({ value }) => {
    expect(isPartId(value)).toBe(false);
  });
});
