# auto-worktree

English | [日本語](../ja/mods/auto-worktree.md)

Creates a git worktree and moves the session into it when you send the session's first prompt. If you decide what to do before you start a session, the first prompt becomes "what to do in this worktree", and the work goes on without touching the main checkout. Sessions running side by side do not trip over each other's files.

Claude Code can create worktrees (`claude --worktree`, the EnterWorktree tool), but the extension has no setting that creates one for every new session. auto-worktree fills that gap.

## What happens on the first prompt

1. Before your prompt reaches Claude, auto-worktree makes the same call Claude makes with EnterWorktree. A worktree is created at `.claude/worktrees/<random name>` and work starts on the branch `worktree-<name>`
2. It shows a toast and tells Claude by attaching a note to the first prompt. The extension shows no toasts, so Claude says it at the start of its first reply
3. So the worktrees do not show up in the main checkout's `git status`, it adds `/.claude/worktrees/` to the clone's `.git/info/exclude`, a file that is never committed

Where the branch starts and whether files such as `.env` are copied follow Claude Code's own settings (`worktree.baseRef`, `.worktreeinclude`, `worktree.symlinkDirectories`). auto-worktree has no settings of its own.

If you deny EnterWorktree when asked, or the worktree cannot be created, it shows the reason in a toast and sends the prompt from the original directory.

## When it does not move

It does nothing when any of these is true:

- It is the second or a later prompt. A resumed session has already sent prompts, so it does not move either
- Nobody is attending the session (`claude -p` and the like)
- It is outside a git repository
- The session is already in a worktree

To a mod, an extension session has no screen, just like `claude -p`. So when the environment variable `CLAUDE_CODE_ENTRYPOINT` is `claude-vscode`, auto-worktree treats the session as one a person is using.

`/auto-worktree` tells you whether the current session will move, and why. Its reply is in Japanese:

```text
次のプロンプトでワークツリーに入ります。
ディレクトリ: /Users/me/repo
リポジトリ: /Users/me/repo
画面: なし
起動元: claude-vscode
これまでのプロンプト: 0 通
```

(It will move into a worktree on the next prompt; then the directory, repository, screens, entrypoint, and the number of prompts sent so far.)

## git keeps working with rtk installed

In a session that has moved into a worktree, Claude Code refuses git commands when it cannot tell which directory they target. The [rtk](https://github.com/rtk-ai/rtk) hook rewrites `git status` to `rtk git status`, so without help every git command would be refused.

Inside the worktree, auto-worktree turns each `git` in command position into `\git` when Claude runs Bash, before the rtk hook sees it.

- To the shell, `\git` is the same as `git`, and Claude Code's permission rules (`Bash(git push:*)` and so on) still match it
- rtk leaves this form alone, so it passes the isolation check
- Only `git` in command position changes. Quoted text, `git` as an argument, here-document bodies and comments stay as they are

The cost: inside the worktree, git output is no longer compressed by rtk. Also, `\git` skips shell aliases, so if `git` is an alias in your shell, the alias is not used.

The rtk hook itself is left untouched because rtk checks the hook's hash; changing it stops every rtk rewrite.

## Commands

| Command | What it does |
| --- | --- |
| `/auto-worktree` | Says whether this session will move into a worktree on the next prompt, and why |

## Cleaning up

auto-worktree never removes the worktrees it creates. When you are done, use ExitWorktree in the session or run `git worktree remove .claude/worktrees/<name>` in a terminal. The branch `worktree-<name>` also stays; delete it with `git branch -d` if you no longer need it.

The editor window keeps the original folder open. Open the worktree's files from `.claude/worktrees/<name>/` inside it.
