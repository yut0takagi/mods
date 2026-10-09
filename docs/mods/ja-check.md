# ja-check

English | [日本語](../ja/mods/ja-check.md)

Even when CLAUDE.md asks for replies in Japanese, the closing report after many tool calls sometimes comes out in English. ja-check looks at how each reply starts when a turn ends and tells you if it is English. A setting makes it ask for a Japanese rewrite instead.

## How it decides a reply is English

It looks only at the start of the reply, and decides on the first line whose language it can tell.

- It skips code blocks, headings, tables, paths and URLs
- It does not decide on a line with fewer than three English words (`OK`, `Done.` and so on)
- It gives up after three undecided lines in a row
- If the reply starts in Japanese, switching to English later does not trigger it

Subagent replies and interrupted turns are skipped.

## Settings

| `mode` | What it does |
| --- | --- |
| `toast` (default) | Only shows a toast |
| `rewrite` | Sends one prompt asking Claude to rewrite the same content in Japanese. If the rewrite is in English too, it stops asking and only shows a toast |

`rewrite` adds a turn for the rewrite, which uses that many more tokens.

## In the extension

The extension shows no toasts, so `toast` mode looks like it does nothing. In the extension, use `rewrite`; the prompt asking for a rewrite is sent there too.
