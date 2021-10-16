# Obsidian Another Quick Switcher Plugin

[![release](https://img.shields.io/github/release/tadashi-aikawa/obsidian-another-quick-switcher.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/latest)
[![Tests](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/workflows/Tests/badge.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/actions)
![downloads](https://img.shields.io/github/downloads/tadashi-aikawa/obsidian-another-quick-switcher/total)

This is an Obsidian plugin which is another choice of Quick switcher.

- `Another Quick Switcher` can search **regardless of the appearance order of tokens**
- `Another Quick Switcher` shows suggestions order by prioritizing both last opened time and modified time **even after typing** (Recent search)
- `Another Quick Switcher` can search backlinks and move them **without leaving from a keyboard** (Backlink search)
- `Another Quick Switcher` can search to **consider prefix emoji**.
- `Another Quick Switcher` **only searches Markdown files**.
- `Another Quick Switcher` does not search very fuzzy
- `Another Quick Switcher` shows file names and directory names separately

At the moment, there are only a few options. However, if you would like to customize behavior, I will add options to make it better as well as I can :)

## ⌨️Features

### Normal Search

One of the following.

- Run `Another Quick Switcher: Normal search` on `Command palette`
- Push `Ctrl/Cmd + Shift + P` in the default case
- Search query starts with `:n ` like `:n hoge`

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/normal.gif)

### Recent Search

One of the following.

- Run `Another Quick Switcher: Recent search` on `Command palette`
- Push `Ctrl/Cmd + Shift + E` in the default case
- Search query starts with `:r ` like `:r hoge`

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/recent.gif)

### Backlink Search

One of the following.

- Run `Another Quick Switcher: Backlink search` on `Command palette`
- Push `Ctrl/Cmd + Shift + H` in the default case
- Search query starts with `:b ` like `:b hoge`

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/backlink.gif)

## ⏬ Install

Download 3 files from a [Releases page].

- `main.js`
- `styles.css`
- `manifest.json`

And copy to directory, `<your-vault>/.obsidian/plugins/obsidian-another-quick-switcher/`.

ℹ I'm hoping to upload it as `Community plugins` when it's a bit more stable, just a moment, please :)

[releases page]: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/latest

## 🛣 Roadmap

- [ ] Add support for mobile (#2)
  - [ ] Fix Layout issues
  - [ ] Fix sidebar icon issues
- [ ] Switch between ignore profiles (#3)

## 🖥️ For developers

- Requirements
  - [Task]

### Development

```console
task init
task dev
```

### Release

```console
task release VERSION=1.2.3
```

[task]: https://github.com/go-task/task
