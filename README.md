# Obsidian Another Quick Switcher Plugin

[![release](https://img.shields.io/github/release/tadashi-aikawa/obsidian-another-quick-switcher.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/latest)
[![Tests](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/workflows/Tests/badge.svg)](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/actions)
![downloads](https://img.shields.io/github/downloads/tadashi-aikawa/obsidian-another-quick-switcher/total)

This is an Obsidian plugin which is another choice of Quick switcher.

- It can create custom search commands (`Custom searches`)
- It allows you to customize the hotkeys in the quick switcher to your preference
- It can search backlinks and move them **without leaving from a keyboard** (`Backlink search`)
- It can move a file to another folder (`Move file to another folder`)
- It can search **regardless of the appearance order of tokens**
- It does not search very fuzzy (e.g. searching for `201` doesn't match `2.01`) 
- Search with different keyboard layouts (like transliteration or forgot-to-switch-layout), supports layouts usually used in countries: 🇺🇦,🇵🇱,🇩🇪,🇲🇩,🇷🇴,🇫🇷,🇹🇷,🇵🇹,🇪🇸,🇮🇹. For users from Ukraine, this will be a good update.
- It can search to **consider prefix emoji**
- It shows file names and directory names separately

## ⏬ Install

You can download from `Community plugins` in Obsidian settings.

## ⌨️Features

### 1. Custom searches

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/custom-searches.gif)


Custom searches enables you to create your original search commands.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/search-commands-setting.png)

#### Search target

| Name     | Description                                          |
| -------- |------------------------------------------------------|
| markdown | All markdown files                                   |
| backlink | Markdown files in backlinks on the current file      |
| link     | Markdown files in outgoing links on the current file |

#### Sort priorities

You can use the following names as a `Sort priorities`.

| Name                        | Description                                            | Since |
| --------------------------- | ------------------------------------------------------ | ----- |
| Perfect word match          | A query matches perfectly with a word in the file name | 6.0.0 |
| Prefix name match           | The file name or alias starts with a query             | 6.0.0 |
| Name match                  | The file name or alias includes a query                | 6.0.0 |
| Tag match                   | The tag name in the file includes a query              | 6.0.0 |
| Header match                | The header name in the file includes a query           | 6.0.0 |
| Link match                  | The internal link name in the file includes a query    | 6.0.0 |
| Length                      | Length of the file name or alias                       | 6.0.0 |
| Last opened                 | The time the file opened last                          | 6.0.0 |
| Last modified               | The time the file modified last                        | 6.0.0 |
| Star                        | The file has a star                                    | 6.0.0 |
| Alphabetical                | File name or alias order by alphabetically ascend      | 6.2.0 |
| Alphabetical reverse        | File name or alias order by alphabetically descend     | 7.0.0 |
| Created latest              | File creation date from the latest to the earliest     | 7.0.0 |
| Created earliest            | File creation date from the earliest to the latest     | 7.0.0 |
| (Tags split by comma)       | The file has specific tags                             | 7.0.0 |
| (Extensions split by comma) | The file has specific extensions                       | 8.3.0 |

> **Warning**
> Please don't forget to click the `Save` button before you close Obsidian. Otherwise, the settings **will never restore** when you open Obsidian next time.
> ![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/save-button.png)

> **Note**
> Examples of `(Tags spit by comma)` are `#hoge`, `#hoge,#huga`, and so on.

> **Note**
> Examples of `(Extensions spit by comma)` are `.md`, `.md,.canvas`, and so on.

#### Preset search commands

<details>
  <summary>Recent search</summary>
  <img src="https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/recent-search-setting.png" alt="recent search" />
</details>

<details>
  <summary>File name search</summary>
  <img src="https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/file-name-search-setting.png" alt="file name search" />
</details>

<details>
  <summary>Landmark search</summary>
  <img src="https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/landmark-search-setting.png" alt="landmark search" />
</details>

<details>
  <summary>Star search</summary>
  <img src="https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/star-search-setting.png" alt="star search" />
</details>

<details>
  <summary>Backlink search</summary>
  <img src="https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/backlink-search-setting.png" alt="backlink search" />
</details>

#### Note

##### Queries enclosed in double quotes are searched as is

- `"ho ge"` only matches `ho ge` not `hoge`
- `ho ge` matches both `ho ge` and `hoge`

##### A minus sign at the beginning excludes the matched candidates

Ex: If there are three files.

- hoge.md
- hoge
- mdhoge

`hoge -md` suggests only `hoge`.

### 2. Header floating search in file / Header search in file

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/header-floating-search-in-file.gif)

- Show all headers even after filtering to retain file structures in the brain
- Jump to the first hit suggestion automatically and move next/previous by `Tab/Shift+Tab` as default
- Queries enclosed in double quotes are searched as is
    - `"ho ge"` only matches `ho ge` not `hoge`
    - `ho ge` matches both `ho ge` and `hoge`

### 3. Grep

This feature requires [ripgrep](https://github.com/BurntSushi/ripgrep) and set the executable command to "Ripgrep command" option.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/grep.gif)

#### Default hotkeys

- `TAB`: Search (not realtime)
- `Ctrl+,`: preview

#### Note

- Input regards as a regex pattern

### 4. Customizable hotkeys

Detailed hotkeys customization is available for each dialog.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/customizable-hotkeys-setting.png)

### 5. Show backlinks from the dialog

You can show the backlinks about the suggestion in the dialog. (Default hotkey is `Mod h`)

It can show backlinks from not only existing notes but also phantom(not existing) notes.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/show-backlinks-from-the-dialog.gif)

### 6. Navigate outgoing/backlinks without leaving the dialog

You can navigate outgoing/backlinks without leaving the dialog by using the "show links", "show backlinks", "navigate forward", and "navigate back" commands.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-another-quick-switcher/master/demo/navigate-outgoing-backlinks-without-leaving-the-dialog.gif)

### 7. Preview

You can preview the file without closing the dialog. It shows a floating view that doesn't distract the contents. Additionally, it makes the editor state before opening the dialog after previewing files and closing the dialog.

https://user-images.githubusercontent.com/9500018/216806330-daf57b52-d8a4-42e3-9803-ba7d76a93319.mp4

## For users who use earlier than v8.0.0

Please read a "🔥 Breaking changes" section in the [Release note](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/tag/8.0.0).

## For users who use earlier than v7.0.0

Please read a "🔥 Breaking changes" section in the [Release note](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/tag/7.0.0).

## For users who use earlier than v6.0.0

Please read a "🔥 Breaking changes" section in the [Release note](https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/releases/tag/6.0.0).

## 📱 Mobile support

It both supports desktop and mobile.

## Feature requests / Bugs

Please create a new [issue].

---

## 🖥️ For developers / contributors

### Development

[Task] is required.

```console
task init
task dev
```

### Release

```console
# Stable
task release VERSION=1.2.3

# Beta
task release VERSION=1.2.3-beta1
```

[task]: https://github.com/go-task/task
[issue]: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/issues
[discussion]: https://github.com/tadashi-aikawa/obsidian-another-quick-switcher/discussions

<a href="https://www.buymeacoffee.com/mamansoft"><img src="https://img.buymeacoffee.com/button-api/?text=Buy me a coffee&emoji=&slug=mamansoft&button_colour=40DCA5&font_colour=ffffff&font_family=Comic&outline_colour=000000&coffee_colour=FFDD00" /></a>
