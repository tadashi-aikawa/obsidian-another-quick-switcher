# Another Quick Switcher Release Workflow

## 対象リポジトリの前提

- Tests workflow: `.github/workflows/tests.yaml`
  - `bun run ci` を実行する。
- Release workflow: `.github/workflows/release.yaml`
  - `workflow_dispatch` で手動実行する。
  - `cycjimmy/semantic-release-action` を使って release する。
- semantic-release 設定: `.releaserc.mjs`
  - `branches: ["master"]`
  - `prepareCmd: bun run ci && bun version-bump.mts ${nextRelease.version}`
  - GitHub release asset: `main.js`, `styles.css`, `manifest.json`, `manifest-beta.json`
  - release commit asset:
    - `package.json`
    - `manifest-beta.json`
    - `manifest.json`
    - `versions.json`
    - `bun.lockb`

## release 種別ルール

- `major`: breaking change
- `minor`: `feat`, `build`, `style`
- `patch`: `fix`, `refactor`, `revert`

## 自動化スクリプトの責務

1. ブランチと作業ツリーの安全性を確認する。
2. `bun run pre:push` を通す。
3. `tests.yaml` の最新実行が成功していることを確認する。
4. `release.yaml` の進行中実行がないことを確認する。
5. `release.yaml` を dispatch して完了まで待つ。
6. 新しい GitHub release を検出する。
7. リリースノートから `#<issue番号>` を抽出する。
8. 関連 Issue 候補一覧を表示し、返信文テンプレートを生成してクリップボードにコピーする。
9. 最後に `git pull --ff-only origin <branch>` で同期する。

## Troubleshooting

### tests が成功していない

- `gh run list --workflow tests.yaml --branch master` で最新状態を確認する。
- 必要ならローカルで `bun run pre:push` を再実行して差分を修正する。

### release workflow が進行中

- 既存 run が `queued` または `in_progress` の場合は待機する。
- 該当 run を Web UI で確認する。

### 新しい release が見つからない

- `gh release list --limit 5` でタグ生成の有無を確認する。
- `release.yaml` run のログで semantic-release 判定を確認する。

### Issue 返信文テンプレート生成に失敗する

- `gh auth status` で認証を確認する。
- rate limit または権限不足のときは一覧表示された Issue を手動で確認し、返信文を手動作成する。
