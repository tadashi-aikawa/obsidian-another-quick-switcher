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
- It can search **from headers**
- It can move a file to another folder (`Move file to another folder`)
- It can search to **consider prefix emoji**
- It **only searches Markdown files** except for the case of `Move file to another folder`
- It does not search very fuzzy
- It shows file names and directory names separately

At the moment, there are only a few options. However, if you would like to customize behavior, I will add options to make it better as well as I can :)

## 👥 For users

### Feature requests / Bugs

Please create a new [issue].

### Questions / Others

Please create a new [discussion].

### Pull requests

Before creating a pull request, please make an [issue] or a [discussion]😉

[issue]: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues
[discussion]: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/discussions

## ⌨️Features

### 1‍⃣ File searches

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/file-searches.gif)

File searches have many commands that have different sort priorities. Below are the definitions of sort priorities.

| Name               | Description                                           |
| ------------------ | ----------------------------------------------------- |
| Perfect word match | A query matches perfectly with a word in the filename |
| Prefix name match  | The filename starts with a query                      |
| Name match         | The filename includes a query                         |
| Length             | Length of the filename                                |
| Last opened        | The time the file opened last                         |
| Last modified      | The time the file modified last                       |
| Tag match          | The tag name in the file includes a query             |
| Header match       | The header name in the file includes a query          |
| Link match         | The internal link name in the file includes a query   |
| Star               | The file has a star                                   |

#### Normal search

`Sort priorities`
1. `Perfect word match`
2. `Prefix name match`
3. `Name match`
4. `Length`
5. `Last opened`
6. `Last modified`

#### Recommended recent search

`Sort priorities`
1. `Name match`
2. `Tag match`
3. `Header match`
4. `Link match`
5. `Last opened`
6. `Last modified`

#### Recent search

`Sort priorities`
1. `Last opened`
2. `Last modified`

#### Filename recent search

`Sort priorities`
1. `Perfect word match`
2. `Name match`
3. `Last opened`
4. `Last modified`

#### Star Recent Search

`Sort priorities`
1. `Star`
2. `Last opened`
3. `Last modified`
4. `Perfect word match`
5. `Name match`

### 2‍⃣ Backlink search

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/backlink-search.gif)

### 3‍⃣ Header floating search in file / Header search in file

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/header-floating-search-in-file.gif)

- Show all headers even after filtering to retain file structures in the brain
- Jump to the first hit suggestion automatically and move next/previous by `Tab/Shift+Tab` as default

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
# Beta
task release-beta VERSION=1.2.3-beta1

# Stable
task release VERSION=1.2.3
```

[task]: https://github.com/go-task/task
