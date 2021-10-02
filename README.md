# Obsidian Another Quick Switcher Plugin

This is an Obsidian plugin for those who prefer to search files not so much fuzzy. Moreover..

- `Another Quick Switcher` can search **regardless of the appearance order of tokens**
- `Another Quick Switcher` shows file names and directory names separately
- `Another Quick Switcher` shows suggestions order by prioritizing both last opened time and modified time **even after typing**

## ⌨️Features

### Normal Search

Run `Another Quick Switcher: Normal search` on `Command palette` or push `Ctrl + Shift + P`.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/normal.gif)

### Recent Search

Run `Another Quick Switcher: Recent search` on `Command palette` or push `Ctrl + Shift + E`.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/recent.gif)

If the query starts with `/`, it behaves as `Normal Search`.

### Backlink Search

Run `Another Quick Switcher: Backlink search` on `Command palette` or push `Ctrl + Shift + H`.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/backlink.gif)

⚠️This feature is an experimental feature. And it has unsafe implementation, so there are risks it is not working someday :)

## ⏬Install

Download 3 files from a [Releases page].

- `main.js`
- `styles.css`
- `manifest.json`

And copy to directory, `<your-vault>/.obsidian/plugins/obsidian-another-quick-switcher/`.

[Releases page]: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/latest

## 🖥️For developers

### Release

```console
task release VERSION=1.2.3
```
~~~~
