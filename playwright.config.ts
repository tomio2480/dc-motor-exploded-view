import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;
// 既定のブラウザーを使えない環境では，Chromium の実行ファイルを環境変数で指定する．
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const launchOptions = {
  // GPU のない CI でも WebGL を描画できるよう，ソフトウェア描画を許可する．
  args: ["--enable-unsafe-swiftshader"],
  ...(chromiumPath === undefined ? {} : { executablePath: chromiumPath }),
};

export default defineConfig({
  testDir: "e2e",
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["html"]],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
    launchOptions,
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
    reuseExistingServer: process.env.CI === undefined,
  },
});
