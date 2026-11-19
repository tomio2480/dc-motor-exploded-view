// favicon の PNG と OGP 画像を，SVG と実際の画面から生成する．
// 使い方: npm run generate:assets
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { build, preview } from "vite";

const PUBLIC_DIR = new URL("../public/", import.meta.url);
const PREVIEW_PORT = 4174;
const ICONS = [
  { file: "favicon-32.png", size: 32 },
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
];
const OG_SIZE = { width: 1200, height: 630 };
// OGP 画像では操作用の要素を隠し，題名を大きく見せる．
const OG_STYLE = `
  .controls, .parts-panel, .stage__hint { display: none; }
  .masthead { padding: 28px 40px 20px; border-bottom: 0; }
  .masthead h1 { font-size: 2.6rem; }
  .masthead__title p { font-size: 1.3rem; }
`;

const chromiumPath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
const browser = await chromium.launch({
  args: ["--enable-unsafe-swiftshader"],
  ...(chromiumPath === undefined ? {} : { executablePath: chromiumPath }),
});

try {
  const iconSvg = await readFile(new URL("favicon.svg", PUBLIC_DIR), "utf8");
  for (const { file, size } of ICONS) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
    });
    await page.setContent(
      `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${iconSvg}`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(file, PUBLIC_DIR)),
      omitBackground: true,
    });
    await page.close();
  }

  await build({ logLevel: "warn" });
  const server = await preview({
    logLevel: "warn",
    preview: { port: PREVIEW_PORT, strictPort: true },
  });
  try {
    const page = await browser.newPage({ viewport: OG_SIZE });
    await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "light" });
    await page.goto(`http://localhost:${PREVIEW_PORT}/`);
    await page.waitForSelector('#stage[data-ready="true"]');
    await page.addStyleTag({ content: OG_STYLE });
    // 表示領域の大きさが変わった後の再描画を待つ．
    await page.waitForTimeout(500);
    await page.screenshot({
      path: fileURLToPath(new URL("og.png", PUBLIC_DIR)),
    });
  } finally {
    await server.close();
  }
} finally {
  await browser.close();
}
