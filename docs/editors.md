# Using the VS Code and Cursor extension

English | [日本語](ja/editors.md)

The extension does not show what mods draw on screen: status lines, toasts, panes, bands and buttons. So in the extension, each mod reports through command replies or through Claude's replies instead. This was checked with the Claude Code 2.1.289 VS Code extension and with Cursor.

## What gets through

| Gets through | Does not |
| --- | --- |
| Sounds (done-chime) | Status lines |
| Replies to slash commands | Toasts |
| Notes a mod attaches for Claude (Claude passes them on in its reply) | Panes and bands |
| Stopping a tool call (push-gate, branch-watch) | Buttons |

To a mod, an extension session looks like a session with no screen, the same as one run with `claude -p`. auto-worktree therefore treats a session as one a person is using when the environment variable `CLAUDE_CODE_ENTRYPOINT` is `claude-vscode`.

## How each mod works in the extension

| Mod | In the extension |
| --- | --- |
| auto-worktree | Claude says at the start of its first reply that the session moved into a worktree |
| branch-watch | `/branch-watch` replies with the baseline, the current branch and the session list. Claude mentions a branch change in its reply (once per change) |
| push-gate | No approve button. Type `/push-gate approve` in the prompt input to approve, or `/push-gate reject` to cancel |
| session-diff | `/session-diff` replies with the edited files; `/session-diff <path>` replies with that file's diff |
| pr-pane | `/prs` replies with the pull requests and their CI. Periodic refreshes stop while there is no screen |
| side-question | `/btw <question>` waits for the answer and puts it in the reply |
| usage-meter | `/usage-meter` replies with the latest turn's numbers and the trend over the last 40 turns |
| done-chime | Sounds only (macOS) |
| ja-check | No toasts, so the default `toast` mode looks like it does nothing. In the extension, set `mode` to `rewrite` to have it ask for a Japanese rewrite |

## Anything in a reply stays in the conversation

Claude reads command replies too, so whatever a reply shows becomes part of the conversation and stays in Claude's context for later turns. In the terminal, side-question keeps its answers out of the conversation; in the extension, they stay in it. The same goes for diffs and pull request lists: showing a large diff many times uses that much context.

## push-gate only accepts approval typed into the prompt input

Writing "approved" or "go ahead and push" in the chat does not count as approval. You have to type `/push-gate approve` in the prompt input, so that Claude cannot approve its own command. After you approve, push-gate sends a message asking Claude to run the same command, and that command goes through once.

## Not verified

Output meant for people only and hidden from Claude (`$.ui.log`, `session.append` system rows) is probably not drawn in the extension either. This comes from reading the extension's code and has not been checked in practice. A future version of the extension may start drawing mod UI.
