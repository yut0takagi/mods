# usage-meter

English | [日本語](../ja/mods/usage-meter.md)

Shows the latest turn's token counts in the status line and charts them over the session. You can see, while you work, whether the prompt cache is doing its job and whether the conversation is growing.

## Reading the status line

The status line is in Japanese:

```text
入力 52.1k / 出力 1.3k · キャッシュ 94% · 計 1.25M
```

| Item | Meaning |
| --- | --- |
| 入力 (input) | Input tokens of the latest turn, including tokens read from and written to the prompt cache |
| 出力 (output) | Output tokens of the latest turn |
| キャッシュ (cache) | Share of the input read from the prompt cache |
| 計 (total) | Input plus output over the turns it remembers (up to the last 200) |

A sudden drop in the cache share means the cache could not be used. It happens when the cache expired after a pause, or when the start of the conversation changed (switching models, for example).

## Commands

| Command | What it does |
| --- | --- |
| `/usage-meter` | Shows the trend over the session in a pane |

In the terminal, it draws one bar per turn: blue at the bottom for input read from the cache, orange above it for other input and output. Other screens show a single line of bar characters (▁▂▃▅▇).

## What it counts

- Subagent turns are not counted
- It remembers the last 200 turns

## In the extension

With no status line or pane, `/usage-meter` replies with the latest turn's numbers and the trend over the last 40 turns as bar characters.
