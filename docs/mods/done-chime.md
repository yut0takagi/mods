# done-chime

English | [日本語](../ja/mods/done-chime.md)

Plays a sound and shows a toast when a long turn ends, so you can hand work to Claude, switch to another window, and still notice when it is done. When Claude is waiting for your permission to use a tool, it plays a different sound.

## Two sounds

| Sound | When it plays |
| --- | --- |
| Two rising notes | A turn that took `minSeconds` or longer ends. The toast shows how long it took (in Japanese, for example 「完了しました（2分13秒）」). If the turn stopped without finishing its reply, because of an error for example, the toast says 「途中で止まりました」 |
| Two notes at the same pitch | Claude is waiting for permission to use a tool. Plays however long the turn is |

Turns you interrupted and subagent turns are not announced.

The sounds were synthesized from sine waves in Python and live in `done-chime/sounds/`.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `minSeconds` | `60` | Turns shorter than this are not announced |
| `sound` | `true` | Turn off to get toasts only |

## Requirements

Sounds play on macOS only. On other systems it shows toasts only. The extension shows no toasts, so there it plays sounds only.
