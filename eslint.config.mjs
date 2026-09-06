import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

// このファイルは、Obsidianコミュニティプラグインディレクトリの自動レビュー(スキャナー)と
// 同じ判定をローカル/CIで再現するための設定。
// 出典: https://github.com/obsidianmd/eslint-plugin/blob/main/docs/configuration.md
//   - 「Community plugin scanner configuration」節
//   - 「Full scanner-equivalent configuration」
//
// スキャナーはrecommended設定をベースに、次の調整をしている
//   1. セキュリティ上重要な6ルールだけ error のまま
//   2. それ以外の有効なルールはすべて warn へ格下げ
//   3. 誤検知が多い・スキャナー側で別途チェックするルールは off
//
// AQSでは error が0件であることを `bun run lint:obsidian` (pre:push) で保証する。
// warn は方針判断が要るため落とさない。全件見るときは `bun run lint:obsidian:all`。

/** スキャナーが error のまま残すルール(ディレクトリ登録を外される原因になる) */
const SCANNER_ERROR_RULES = {
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-unsanitized/method": "error",
  "no-unsanitized/property": "error",
  "obsidianmd/regex-lookbehind": "error",
  "obsidianmd/no-forbidden-elements": "error",
};

/** スキャナーが off にするルール */
const SCANNER_OFF_RULES = {
  // TypeScriptでカバー済み、またはノイズが多い
  "no-undef": "off",
  "@typescript-eslint/no-unsafe-member-access": "off",
  "@typescript-eslint/no-unsafe-assignment": "off",
  "@typescript-eslint/no-unsafe-argument": "off",
  "@typescript-eslint/no-unsafe-call": "off",
  "@typescript-eslint/no-unsafe-return": "off",
  "@typescript-eslint/restrict-template-expressions": "off",
  "@typescript-eslint/no-base-to-string": "off",
  "import/no-unresolved": "off",
  // スキャナーが別枠でチェックする
  "obsidianmd/validate-manifest": "off",
  "obsidianmd/validate-license": "off",
  // 既存プラグインはコマンドIDを変えられないため
  "obsidianmd/commands/no-command-in-command-id": "off",
  "obsidianmd/commands/no-plugin-id-in-command-id": "off",
};

/** off以外の重大度をwarnへ格下げする(オプションは維持する) */
function downgradeSeverity(entry) {
  const isOff = (severity) => severity === "off" || severity === 0;
  if (Array.isArray(entry)) {
    const [severity, ...options] = entry;
    return isOff(severity) ? entry : ["warn", ...options];
  }
  return isOff(entry) ? entry : "warn";
}

/**
 * recommended設定の全ルールをwarnへ格下げする。
 * docsのサンプル設定はこの格下げを再現していないため、ここで自前で行う。
 */
function downgradeToWarn(configs) {
  return configs.map((config) => {
    if (!config.rules) {
      return config;
    }
    return {
      ...config,
      rules: Object.fromEntries(
        Object.entries(config.rules).map(([name, entry]) => [
          name,
          downgradeSeverity(entry),
        ]),
      ),
    };
  });
}

export default defineConfig([
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          allowDefaultProject: ["eslint.config.*", "manifest.json"],
        },
        extraFileExtensions: [".json"],
      },
    },
  },

  ...downgradeToWarn(obsidianmd.configs.recommended),

  {
    files: ["**/*.{ts,cts,mts,tsx,js,cjs,mjs,jsx}"],
    rules: {
      ...SCANNER_ERROR_RULES,
      ...SCANNER_OFF_RULES,
    },
  },

  globalIgnores([
    // ここからスキャナーと同じ除外パターン
    "node_modules",
    "dist",
    "build",
    "pkg",
    "test-vault",
    ".obsidian",
    "**/.obsidian/**",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "**/*.test.*",
    "**/*.tests.*",
    "**/*.spec.*",
    "**/*.specs.*",
    "**/test/**",
    "**/tests/**",
    "**/__tests__/**",
    "**/mocks/**",
    "**/__mocks__/**",
    "**/*.cjs",
    "**/*.mjs",
    "**/*.cts",
    "**/*.mts",
    "**/vite*",
    "**/scripts/**",
    "**/docs/**",
    "**/i18n/**",
    "**/i18next/**",
    "**/locale/**",
    "**/locales/**",
    "**/translations/**",
    "**/l10n/**",
    ".pnpm-store",
    "**/*.spec.ts",
    "**/testUtils**",
    "automation/**",
    "e2e-tests/**",
    // ここからAQS固有の非ソース
    "main.js",
    "demo/**",
    ".claude/**",
    ".agents/**",
    ".vscode/**",
    "hooks/**",
    "jest.config.js",
  ]),
]);
