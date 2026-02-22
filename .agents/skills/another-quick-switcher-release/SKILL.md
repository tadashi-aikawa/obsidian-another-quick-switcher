---
name: another-quick-switcher-release
description: Another Quick Switcher のリリース運用を実施するときに使う。事前検証 (pre:push と CI 状態確認)、Release workflow の dispatch、完了待機、新規 release 検出、リリースノート由来の Issue 一覧と返信文の作成、最後の同期までを一連で安全に進める用途で利用する。
---

# Another Quick Switcher Release

## Overview

この Skill は `obsidian-another-quick-switcher` のリリース作業を再現可能な手順に固定する。
確定的な検証・実行は同梱スクリプトが担当し、非確定的な文章生成は Codex (LLM) が担当する。

## Runbook

1. 実行前提を満たす。
   - `bun` が利用可能
   - `gh` が利用可能
   - `gh auth status` が成功
2. Codex CLI から実行する場合は、`gh` を使うコマンドを最初から escalated で実行する。
   - 対象: `gh auth status` / `bun .agents/skills/another-quick-switcher-release/scripts/release.ts ...`
   - 理由: sandbox と host で `gh` の認証コンテキストが異なる場合があるため
3. リポジトリルートで次を実行する。
   - `bun .agents/skills/another-quick-switcher-release/scripts/release.ts`
4. スクリプトの `=== RELEASE_RESULT_JSON_BEGIN ===` から `=== RELEASE_RESULT_JSON_END ===` までの JSON を読み取り、次を標準出力する。
   - Bluesky 投稿案 (日本語で自然な表現)
   - Issue 返信テンプレート (下記フォーマット)
5. 投稿案・返信文はクリップボードにコピーせず、標準出力へ表示する。
6. 動作確認のみ行うときは dry-run を使う。
   - `bun .agents/skills/another-quick-switcher-release/scripts/release.ts --dry-run`

## Script Options

- `--branch <name>`: 対象ブランチを指定する。既定は `master`。
- `--dry-run`: dispatch / git pull を実行しない。
- `--skip-issue-notify`: Issue 候補一覧表示をスキップする。
- `--help`: 使い方を表示する。

## Output Contract

- スクリプトは実行ログに加え、最後に `RELEASE_RESULT_JSON` ブロックを標準出力する。
- LLM はこの JSON の `release` / `issueCandidates` を入力として文章を作る。
- `issueCandidates` には Pull Request も含まれるため、Issue 返信テンプレートでは `isPullRequest=false` のみを対象にする。

## Issue Reply Template Format

Issue 返信テンプレートは次の形式で生成する。

```text
- https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/323
- https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues/324

@FelipeRearden
Released in 14.5.0 🚀
```

- URL 行は対象 Issue 数だけ並べる。
- メンション行は対象 Issue の `authorLogin` を重複除去して列挙する。
- `authorLogin` が1人なら1行、複数なら空白区切りで1行にまとめる。

## Bluesky Post Guidelines

- 日本語で、読みやすく自然な表現にする。
- 単なるコミット文の羅列は避け、変更点を要約して伝える。
- リリースURL (`release.url`) を末尾に含める。

## Notes

- 実運用フローと判定基準は `references/release-workflow.md` を参照する。
- 失敗時は、エラーメッセージに対応する troubleshooting 手順を参照する。
- 毎回の権限確認を減らすには、次の `prefix_rule` を永続承認する。
  - `["bun", ".agents/skills/another-quick-switcher-release/scripts/release.ts"]`
  - `["gh", "auth", "status"]`
  - `["gh", "api", "repos/tadashi-aikawa/obsidian-another-quick-switcher"]`
- Skill は手順を定義するためのものであり、権限付与そのものは Codex CLI 側の承認フローで管理される。
