# Obsidian Smart Search Plugin

This is an Obsidian plugin for those who prefer to search files not so much fuzzy.

![Demo](https://raw.githubusercontent.com/tadashi-aikawa/obsidian-smart-search/master/demo/2021-09-19.gif)

## Get started

## Install

Download 3 files.

- `main.js`
- `styles.css`
- `manifest.json`

And copy to directory, `<your-vault>/.obsidian/plugins/obsidian-smart-search/`.

## Search

Run `Smart Search: Search` (`Ctrl + P` as default).

If the query starts with `/`, it shows suggestions as prioritizing matching rate, otherwise as prioritize opened time and modified time recently.

## For developers

### Release

```console
task release VERSION=1.2.3
```
