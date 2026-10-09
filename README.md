# mods

English | [日本語](README.ja.md)

A marketplace of mods for Claude Code. A mod is a plugin that adds features to Claude Code through function hooks.

| Mod | What it does |
| --- | --- |
| [branch-watch](docs/mods/branch-watch.md) | Stops commits on a branch another session switched to, and lists each session's worktree and branch |
| [push-gate](docs/mods/push-gate.md) | Holds `git push` and similar commands until a person approves |
| [auto-worktree](docs/mods/auto-worktree.md) | Creates a worktree on the first prompt and starts the work there |
| [session-diff](docs/mods/session-diff.md) | Shows the files this session edited and their diffs |
| [pr-pane](docs/mods/pr-pane.md) | Shows open pull requests and their CI results |
| [side-question](docs/mods/side-question.md) | `/btw` asks a side question without stopping the work |
| [done-chime](docs/mods/done-chime.md) | Plays a sound when a long turn ends and when Claude waits for permission |
| [ja-check](docs/mods/ja-check.md) | Tells you when a reply starts in English |
| [usage-meter](docs/mods/usage-meter.md) | Shows each turn's token counts and prompt cache rate |

## Install

```sh
claude plugin marketplace add yut0takagi/mods
claude plugin install branch-watch@yut0takagi-mods   # one line per mod you want
```

Developed with Claude Code 2.1.289. Mods are an early access feature, so a Claude Code update may break them. The VS Code and Cursor extension draws no mod UI, so [some mods are used differently there](docs/editors.md).

## Docs

- [Getting started](docs/getting-started.md) (settings, updates, removal)
- [Troubleshooting](docs/troubleshooting.md)
- [All docs](docs/README.md)

To change a mod, read [CONTRIBUTING](CONTRIBUTING.md). Changes are listed in the [CHANGELOG](CHANGELOG.md). Report security problems as described in [SECURITY](SECURITY.md).

## License

[MIT](LICENSE)
