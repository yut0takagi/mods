# branch-watch

English | [日本語](../ja/mods/branch-watch.md)

When two or more Claude Code sessions work in the same worktree and one of them runs `git checkout`, the others do not notice. If one of them then commits, the commit lands on a branch it did not mean to use. branch-watch remembers the branch each session should be on, tells you when it changes, and stops a commit on the changed branch. It also lists which session is on which branch of which worktree.

## How it notices a change

branch-watch keeps a baseline for each worktree: the branch that was checked out when the session first worked in that worktree.

It checks on every tool call and every 15 seconds. The timer catches a switch another session makes while Claude is idle. When the current branch differs from the baseline, it shows a toast once and marks the status line with `⚠`.

It decides which worktree the session is working in, in this order:

1. The worktree of the file last edited with Edit or Write
2. The target of the last command, read from `git -C <dir>` and a leading `cd <dir> &&`
3. Otherwise, the session's directory

Editing outside git (notes under `~/.claude`, for example) does not change the worktree.

## When it stops a commit

It stops any command containing `git commit` when the current branch differs from the baseline. Claude is told why, so it asks you what to do.

When the session itself runs `git checkout`, `git switch` or `gh pr checkout`, the switch is intended and the new branch becomes the baseline. Only switches made by other sessions stop commits.

When a commit is stopped, you have two choices:

- Go back: `git checkout <baseline branch>`
- Continue on the current branch: type `/branch-watch accept` in the prompt input. It is not accepted from Claude or other plugins

## Reading the status line

| Shows | Meaning |
| --- | --- |
| `⎇ repo / feature/a` | Working on branch `feature/a` in worktree `repo`, matching the baseline |
| `⚠ ⎇ repo / feature/b（このセッションは feature/a）` | The baseline is `feature/a`, but the worktree is now on `feature/b` |
| `… 👥 +1` | One more session is running in the same worktree |

The status line text is in Japanese. With a detached HEAD it shows `HEAD` in place of a branch name. It also shows the branch in a repository that has no commits yet.

## Commands

| Command | What it does |
| --- | --- |
| `/branch-watch` | Opens a pane listing the running sessions by worktree and replies with this session's baseline and current branch. If the pane cannot open, the list goes in the reply |
| `/branch-watch accept` | Makes the current branch the baseline. Accepted only when a person types it |

For each session, the pane shows whether it is working or idle, the start of its first prompt (up to 32 characters), and the first 8 characters of its session id. A session on a branch other than its baseline also shows the baseline, and a worktree with two or more sessions is marked with `⚠`.

## Files it writes

To build the list, each session writes its state to `~/.claude/branch-watch/sessions/<session id>.json` every 15 seconds (under `CLAUDE_CONFIG_DIR` if you set it).

- A session that has not written for 60 seconds is treated as stopped and left out of the list
- Files older than 10 minutes are deleted
- A session deletes its own file when it ends

Each file holds the session id, the worktree path, the branch, the baseline, the start of the first prompt, whether it is working, and when it was written. Nothing is sent over the network.

## In the extension

With no status line or toasts, use `/branch-watch` to check the state. When a branch changes, branch-watch adds a short note to the next prompt or tool result for Claude, and Claude tells you in its reply. Each change is reported once, and never to subagents.

## Limitations

- It decides whether a command commits by its text. It cannot see commits made through aliases or scripts
- It reads a command's directory only from `git -C <dir>` and a leading `cd <dir> &&`. Anything else is assumed to run in the session's current directory
- Only sessions with branch-watch installed appear in the list
- Even a read-only command such as `git -C <dir> log` moves the session's worktree to `<dir>`
