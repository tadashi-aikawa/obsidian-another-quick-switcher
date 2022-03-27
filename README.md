# Obsidian Another Quick Switcher Plugin

[![release](https://img.shields.io/github/release/tadashi-aikawa/obsidian-another-quick-switcher.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/latest)
[![Tests](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/workflows/Tests/badge.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/actions)
![downloads](https://img.shields.io/github/downloads/tadashi-aikawa/obsidian-another-quick-switcher/total)

This is an Obsidian plugin which is another choice of Quick switcher.
- It can search **regardless of the appearance order of tokens**
- It shows suggestions order by prioritizing both last opened time and modified time **even after typing** (`Recent search`)
- It can search backlinks and move them **without leaving from a keyboard** (`Backlink search`)
- It can search **by tags** even if queries don't start with `#`
  - When you input queries start with `#`, It priors tag
- It can move a file to another folder (`Move file to another folder`)
- It can search to **consider prefix emoji**
- It **only searches Markdown files** except for the case of `Move file to another folder`
- It does not search very fuzzy
- It shows file names and directory names separately

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

### Move file to another folder

One of the following.

- Run `Another Quick Switcher: Move file to another folder` on `Command palette`
- Push `Ctrl/Cmd + Shift + M` in the default case

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/move-to-folder.gif)

## 📱 Mobile support

It both supports desktop and mobile.

![img_1.png](demo/img_1.png)

## ⏬ Install

You can download from `Community plugins` in Obsidian settings.

![img.png](demo/img.png)

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
