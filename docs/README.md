# Documentation

English | [日本語](ja/README.md)

How to use the nine Claude Code mods in this repository. It is written for people who already use Claude Code and want to try the mods. If you want to change a mod, start with [CONTRIBUTING](../CONTRIBUTING.md).

## Two pages to read first

1. [Getting started](getting-started.md): installing, changing settings, removing
2. [Using the VS Code and Cursor extension](editors.md): only if you use Claude Code outside the terminal. The extension draws no panes or buttons, so several mods are used differently there

After that, open a mod's page when you need it. When something does not work, see [Troubleshooting](troubleshooting.md).

## One page per mod

| Mod | Use it when you want to |
| --- | --- |
| [branch-watch](mods/branch-watch.md) | run several sessions in one worktree without committing to a branch another session switched to |
| [push-gate](mods/push-gate.md) | keep `git push` and `gh pr merge` from running until a person approves |
| [auto-worktree](mods/auto-worktree.md) | have every session start in its own worktree instead of the main checkout |
| [session-diff](mods/session-diff.md) | see what this session changed, and by how much, as it works |
| [pr-pane](mods/pr-pane.md) | watch open pull requests and their CI without leaving Claude Code |
| [side-question](mods/side-question.md) | ask one question about the conversation without stopping the work |
| [done-chime](mods/done-chime.md) | hear when a long turn ends, and when Claude needs your permission |
| [ja-check](mods/ja-check.md) | catch replies that switch to English when you asked for Japanese |
| [usage-meter](mods/usage-meter.md) | see each turn's token counts and how well the prompt cache works |

The first four guard or change git operations. The rest only show information and do not change what Claude does, so they are safe to try (the one exception is ja-check's `rewrite` mode, which sends a prompt asking for a Japanese rewrite).

## Terms

| Term | Meaning in these docs |
| --- | --- |
| mod | A plugin that adds features to Claude Code through function hooks. It can stop tool calls or show information on screen. An early access feature as of Claude Code 2.1.289 |
| session | One conversation, from starting `claude` to quitting it. One chat in the extension |
| turn | From one prompt you send to the end of Claude's reply |
| worktree | A separate working directory made from a repository (`git worktree`). The main checkout is one of them |
| status line | The line under the prompt input in terminal Claude Code |
| pane | An area a mod draws, opened beside the conversation in the terminal |
| band | One or a few lines a mod draws above the prompt input. push-gate's approve button appears there |
| toast | A short notice that disappears after a few seconds |
| baseline | The branch branch-watch remembers as the one a worktree should be on |

## When these docs do not answer your question

Open an [issue](https://github.com/yut0takagi/mods/issues). For a security problem, do not open an issue; follow [SECURITY](../SECURITY.md) instead.
