// 関数ごとの複雑度を cccc で計測し，閾値を超える関数があれば失敗する．
// 使い方: npm run complexity（cccc の場所は環境変数 CCCC_BIN でも指定できる）
//
// 指標: 認知的複雑度 / 循環的複雑度
// 道具: cccc v1.9.2（https://github.com/moznion/cccc）
// 規則: --max-cognitive 15 / --max-cyclomatic 10（値を超える関数で失敗）
// 対象: TARGETS に挙げたディレクトリとファイルのうち，Git の管理対象と未追跡のもの
// 数え方の出典: https://github.com/moznion/cccc/blob/v1.9.2/crates/cccc-core/src/engine.rs
// 仕様との差: 入れ子の関数でネストを 0 に戻し，内側の関数を別の単位として数える
import { execFileSync, spawnSync } from "node:child_process";

const CCCC_VERSION = "1.9.2";
const MAX_COGNITIVE = 15;
const MAX_CYCLOMATIC = 10;
const TARGETS = [
  "src",
  "tests",
  "e2e",
  "scripts",
  "playwright.config.ts",
  "vite.config.ts",
];
const EXTENSIONS = [".ts", ".mjs"];
/** cccc は，閾値を超える関数があると終了コード 1 を返す． */
const EXIT_THRESHOLD_EXCEEDED = 1;

const ccccPath = process.env.CCCC_BIN ?? "cccc";

function fail(message) {
  console.error(`複雑度の検査に失敗: ${message}`);
  process.exit(1);
}

/** 同名の別の道具（C and C++ Code Counter）や別の版を取り違えていないか確かめる． */
function verifyVersion() {
  const result = spawnSync(ccccPath, ["--version"], { encoding: "utf8" });
  if (result.error !== undefined) {
    fail(
      `cccc を実行できない（${result.error.message}）．README の手順で v${CCCC_VERSION} を導入する．`,
    );
  }
  const actual = result.stdout.trim();
  if (actual !== `cccc ${CCCC_VERSION}`) {
    fail(`cccc ${CCCC_VERSION} が必要だが，"${actual}" が見つかった．`);
  }
}

function measure() {
  const result = spawnSync(
    ccccPath,
    [
      "--no-config",
      "--max-cognitive",
      String(MAX_COGNITIVE),
      "--max-cyclomatic",
      String(MAX_CYCLOMATIC),
      ...TARGETS,
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0 && result.status !== EXIT_THRESHOLD_EXCEEDED) {
    fail(`cccc が終了コード ${result.status} で終了した．\n${result.stderr}`);
  }
  return JSON.parse(result.stdout);
}

/** 計測の対象になるはずのファイルを，Git の管理対象と未追跡のファイルから数える． */
function countExpectedFiles() {
  const listed = execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ...TARGETS,
    ],
    { encoding: "utf8" },
  );
  return listed
    .split("\n")
    .filter((path) => EXTENSIONS.some((extension) => path.endsWith(extension)))
    .length;
}

/** 入れ子の関数も含めて，閾値を超える関数を集める． */
function collectViolations(path, functions) {
  return functions.flatMap((entry) => {
    const nested = collectViolations(path, entry.children ?? []);
    const isOver =
      entry.cognitive > MAX_COGNITIVE || entry.cyclomatic > MAX_CYCLOMATIC;
    return isOver ? [{ path, ...entry }, ...nested] : nested;
  });
}

verifyVersion();
const report = measure();
const { summary } = report;

// cccc は解析に失敗しても終了コード 0 を返すため，件数を自分で確かめる．
if (summary.parse_error_count !== 0) {
  fail(
    `解析できないファイルがある: ${(summary.parse_error_files ?? []).join(", ")}`,
  );
}
// 読めなかったファイルは報告から黙って消えるため，件数を突き合わせる．
const expectedFileCount = countExpectedFiles();
if (summary.file_count !== expectedFileCount) {
  fail(
    `計測したファイルは ${summary.file_count} 件だが，対象は ${expectedFileCount} 件ある．`,
  );
}

const violations = report.files.flatMap((file) =>
  collectViolations(file.path, file.functions),
);
for (const violation of violations) {
  console.error(
    `${violation.path}:${violation.line} ${violation.name}` +
      ` 認知的 ${violation.cognitive}（上限 ${MAX_COGNITIVE}）` +
      ` 循環的 ${violation.cyclomatic}（上限 ${MAX_CYCLOMATIC}）`,
  );
}
if (violations.length > 0) {
  fail(`閾値を超える関数が ${violations.length} 件ある．`);
}

console.log(
  `複雑度の検査に成功: ${summary.file_count} ファイル，${summary.function_count} 関数．` +
    `最大値は認知的 ${summary.cognitive.max}（上限 ${MAX_COGNITIVE}），` +
    `循環的 ${summary.cyclomatic.max}（上限 ${MAX_CYCLOMATIC}）．`,
);
