import { defineConfig } from "vitest/config";

export default defineConfig({
  // GitHub Pages のプロジェクトサイト配下でも動くよう，相対パスで出力する．
  base: "./",
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
