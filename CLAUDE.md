# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## **重要事項**

- コードを編集したら必ず `bun check` を実行してください
    - フォーマット・リント・未使用import削除 および 可能な範囲で自動修正を行うコマンドです

## Project Overview

This is an Obsidian plugin called "Another Quick Switcher" that provides advanced file and content navigation capabilities. It offers multiple search modes including file search, grep, header navigation, backlinks, and custom search commands.

## Development Commands

- `bun i` - Install dependencies
- `bun dev` - Development build with watch mode
- `bun run build` - Production build with TypeScript check
- `bun run test` - Run Jest tests
- `bun run ci` - Full CI pipeline (lint, build, test)
- `biome check src *.mts` - Lint TypeScript files
- `tsc -noEmit -skipLibCheck` - Type checking only

## Architecture

### Core Components

**Main Plugin Structure:**
- `src/main.ts` - Plugin entry point, lifecycle management, command registration
- `src/settings.ts` - Comprehensive settings system with 200+ configuration options
- `src/commands.ts` - Command factory functions for different search modes
- `src/app-helper.ts` - Abstraction layer over Obsidian APIs

**Modal System:**
- `src/ui/AnotherQuickSwitcherModal.ts` - Main configurable search modal
- `src/ui/GrepModal.ts` - Text content search using ripgrep
- `src/ui/BacklinkModal.ts` - Backlink navigation
- `src/ui/LinkModal.ts` - Outgoing link navigation  
- `src/ui/HeaderModal.ts` - In-file header navigation
- `src/ui/InFileModal.ts` - In-file text search with quoted phrase support
- `src/ui/FolderModal.ts` & `MoveModal.ts` - File system operations

**Core Systems:**
- `src/matcher.ts` - Text matching and scoring algorithms
- `src/sorters.ts` - 20+ configurable sort priorities
- `src/transformer.ts` - Data transformation for search results
- `src/utils/strings.ts` - String processing utilities including `smartWhitespaceSplit` for quoted phrase parsing

### Key Patterns

1. **Command-Based Architecture** - All functionality exposed through registered Obsidian commands
2. **Settings-Driven Configuration** - Highly customizable behavior through comprehensive settings
3. **Modal Specialization** - Different modal classes for specific search types
4. **External Tool Integration** - Uses ripgrep for performance-critical search operations

### External Dependencies

- **ripgrep** - Required for grep functionality (both content and filename search), set path in "Ripgrep command" setting

## Development Notes

- Uses Bun as package manager and build tool
- TypeScript with strict mode enabled
- Biome for linting and formatting (spaces, not tabs)
- Jest for testing with esbuild transformer
- Obsidian plugin API version 1.7.2+
- **IMPORTANT**: Always run `biome check src` after making code changes to avoid CI failures

### Architecture Guidelines

- **sorters.ts is NOT a generic sort utility**: This file defines only the sort priorities available in the main Search Commands' "Sort priorities" setting. Do not add generic sorting functions or priorities that are specific to individual modals.
- **Modal-specific sorting**: Each modal (like MoveModal) should implement its own sorting logic if it needs custom sorting behavior that differs from the main search priorities.
- **Settings patterns**: Use the `mirror()` utility pattern for dropdown settings, following the same pattern as SearchTarget (e.g., `mirror([...optionsList])` for readonly arrays).

### Implementation Guidelines

- **Single choice over multiple choices**: When designing settings, prefer single-choice dropdowns over multi-choice text areas. This eliminates the need to handle invalid values and simplifies algorithms.
- **Default value handling**: For file path settings, use empty string as default and implement fallback logic in code rather than hardcoding paths in settings. This allows for automatic path selection while still enabling customization.
- **Feature scope validation**: Remove non-functional features early rather than keeping them as placeholders. Half-implemented features cause user confusion.

### Modal Development Guidelines

- Use `safeClose()` for modal transitions to ensure proper state restoration
- New hotkeys in settings should have empty default arrays `[]` (no default shortcuts)
- For GrepModal modifications, initialize after `onOpen()` when `basePath` is available
- Follow existing patterns in `setHotkeys()` for registering new hotkey handlers
- Use `smartWhitespaceSplit()` instead of `split(" ")` for query parsing to support quoted phrases
- Quoted phrase functionality: `"hello world"` searches for exact match, `hello world` searches for both words
- Escape functionality: `\"` allows searching for literal quote characters (e.g., `search \"` finds `search "`)

## Settings Architecture

The plugin has a complex settings system supporting:
- Custom search commands with configurable targets and sorting
- Per-modal hotkey customization
- Path filtering and exclusions
- Search behavior customization (fuzzy matching, prefix matching, etc.)

Settings are deeply merged on load and heavily validated in the UI.

## Testing

Tests are located alongside source files with `.test.ts` suffix. Focus on:
- `transformer.test.ts` - Data transformation logic
- `collection-helper.test.ts` - Utility functions
- `math.test.ts` - Scoring calculations
- `path.test.ts` - Path manipulation
- `strings.test.ts` - String processing

Run tests before any significant changes to ensure compatibility.

## Commit Guidelines

- Use Conventional Commits format: `feat(scope):`, `fix(scope):`, etc.
- Scope examples: `main`, `grep`, `header`, `backlink`, `settings`
- Keep first line concise and user-focused (appears in release notes)
- Add bullet points for implementation details only when necessary
- No default hotkey assignments for new features (user configurable only)
- Use `chore:` for formatting-only changes (not `fix:`) to avoid user confusion
- Format commit messages concisely - avoid unnecessary details for maintenance tasks

## Memory

### 開発環境・ツール
- `bun check`: フォーマット・リント・未使用import削除および自動修正
- `bun pre:push`: lint/format一括チェック
- Always ask for clarification when there are ambiguous instructions

### アーキテクチャパターン
- **Modal実装**: `smartMicroFuzzy`、`createHighlightedText`、`another-quick-switcher__hit_word`CSSクラスで統一
- **設定追加**: `settings.ts`でインターフェース定義 → UI追加 → Modal実装
- **ホットキー**: `setHotkeys`メソッドで`registerKeys`使用、デフォルト値は空配列`[]`
- **共通UI機能**: `src/utils/`に共通関数作成（例: `mouse.ts`のCtrl+click処理）

### GrepModal特有
- AND検索: `smartWhitespaceSplit` → 複数ripgrep実行 → `mergeAndFilterResults`
- 文字位置変換: UTF-8バイト→UTF-16文字位置で`byteToCharPosition`必須
- エラーハンドリング: `isValidRegex`事前チェック + 構造化エラー表示

### 重要な考慮事項
- 外部依存削除時: 設定・UI・チェック処理・説明文・READMEまで一貫更新
- ripgrepバッファ: 大量結果でJSONパースエラー→`maxBuffer`を1GBに増加
- リリース作業: リリースノート記載コミットのみが対象、過去コミットは除外
