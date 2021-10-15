# Obsidian Another Quick Switcher Plugin

[![release](https://img.shields.io/github/release/tadashi-aikawa/obsidian-another-quick-switcher.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/latest)
[![Tests](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/workflows/Tests/badge.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/actions)
![downloads](https://img.shields.io/github/downloads/tadashi-aikawa/obsidian-another-quick-switcher/total)

This is an Obsidian plugin which is another choice of Quick switcher.

- `Another Quick Switcher` can search **regardless of the appearance order of tokens**
- `Another Quick Switcher` shows suggestions order by prioritizing both last opened time and modified time **even after typing**
- `Another Quick Switcher` can search backlinks and move them **without leaving from a keyboard**
- `Another Quick Switcher` can search to **consider prefix emoji**.
- `Another Quick Switcher` does not search very fuzzy
- `Another Quick Switcher` shows file names and directory names separately

At the moment, there are only a few options. However, if you would like to customize behavior, I will add options to make it better as well as I can :)

## ⌨️Features

### Normal Search

Run `Another Quick Switcher: Normal search` on `Command palette` or push `~~~~Ctrl/Cmd + Shift + P`.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/normal.gif)

### Recent Search

Run `Another Quick Switcher: Recent search` on `Command palette` or push `Ctrl/Cmd + Shift + E`.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/recent.gif)

If the query starts with `/`, it behaves as `Normal Search`.

### Backlink Search

Run `Another Quick Switcher: Backlink search` on `Command palette` or push `Ctrl/Cmd + Shift + H`.

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
