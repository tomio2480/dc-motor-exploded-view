import { defineConfig, devices } from "@playwright/test";

const PREVIEW_PORT = 4173;
// 既定のブラウザーを使えない環境では，Chromium の実行ファイルを環境変数で指定する．
const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
/** Chromium 系のプロジェクトだけに渡す起動オプション． */
const chromiumLaunchOptions = {
  // GPU のない CI でも WebGL を描画できるよう，ソフトウェア描画を許可する．
  args: ["--enable-unsafe-swiftshader"],
  ...(chromiumPath === undefined ? {} : { executablePath: chromiumPath }),
};

/**
 * GPU のない Linux では，画面なしの Firefox が WebGL を作れない．
 * その場合は E2E_FIREFOX_HEADED=1 を指定し，xvfb-run の仮想画面の上で実行する．
 */
const isFirefoxHeaded = process.env.E2E_FIREFOX_HEADED === "1";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: process.env.CI !== undefined,
  retries: process.env.CI === undefined ? 0 : 1,
  reporter: process.env.CI === undefined ? "list" : [["list"], ["html"]],
  use: {
    baseURL: `http://localhost:${PREVIEW_PORT}`,
  },
  // プロジェクト名は「エンジン-画面の種類」とし，CI ではエンジンごとに絞って実行する．
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: chromiumLaunchOptions,
      },
    },
    {
      name: "chromium-mobile",
      use: { ...devices["Pixel 7"], launchOptions: chromiumLaunchOptions },
    },
    {
      name: "firefox-desktop",
      use: {
        ...devices["Desktop Firefox"],
        headless: !isFirefoxHeaded,
        launchOptions: {
          // ソフトウェア描画を理由に WebGL が無効化されないようにする．
          firefoxUserPrefs: { "webgl.force-enabled": true },
        },
      },
    },
    {
      name: "webkit-desktop",
      use: { ...devices["Desktop Safari"] },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 15"] },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${PREVIEW_PORT} --strictPort`,
    port: PREVIEW_PORT,
    reuseExistingServer: process.env.CI === undefined,
  },
});
