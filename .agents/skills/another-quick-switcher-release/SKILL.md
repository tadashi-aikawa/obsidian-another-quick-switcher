---
name: another-quick-switcher-release
description: Another Quick Switcher のリリース運用を実施するときに使う。事前検証 (pre:push と CI 状態確認)、Release workflow の dispatch、完了待機、新規 release 検出、リリースノート由来の Issue 一覧と返信文の作成、最後の同期までを一連で安全に進める用途で利用する。
---

# Another Quick Switcher Release

## Overview

この Skill は `obsidian-another-quick-switcher` のリリース作業を再現可能な手順に固定する。
通常は同梱スクリプトを実行し、手作業は最小化する。

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
4. 動作確認のみ行うときは dry-run を使う。
   - `bun .agents/skills/another-quick-switcher-release/scripts/release.ts --dry-run`

## Script Options

- `--branch <name>`: 対象ブランチを指定する。既定は `master`。
- `--dry-run`: dispatch / git pull を実行しない。
- `--skip-issue-notify`: Issue 候補一覧表示と返信文テンプレート生成をスキップする。
- `--help`: 使い方を表示する。

## Notes

- 実運用フローと判定基準は `references/release-workflow.md` を参照する。
- 失敗時は、エラーメッセージに対応する troubleshooting 手順を参照する。
- 毎回の権限確認を減らすには、次の `prefix_rule` を永続承認する。
  - `["bun", ".agents/skills/another-quick-switcher-release/scripts/release.ts"]`
  - `["gh", "auth", "status"]`
  - `["gh", "api", "repos/tadashi-aikawa/obsidian-another-quick-switcher"]`
- Skill は手順を定義するためのものであり、権限付与そのものは Codex CLI 側の承認フローで管理される。
