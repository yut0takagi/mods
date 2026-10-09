# mods

English | [日本語](README.ja.md)

A plugin marketplace of Claude Code mods. A mod is a plugin that extends Claude Code through function hooks: it can block tool calls, show information in the status line, or draw its own pane.

| Mod | What it does |
| --- | --- |
| [branch-watch](#branch-watch) | Shows `⎇ worktree / branch` in the status line and lists in a pane which session works on which branch of which worktree. Warns when another session switches the branch, and blocks `git commit` on a branch you did not switch to |
| [push-gate](#push-gate) | Blocks `git push` and similar commands until a person presses an approve button. The model cannot approve on its own |
| [ja-check](#ja-check) | Warns when a reply opens in English instead of Japanese, and can ask Claude to rewrite it |
| [done-chime](#done-chime) | Plays a sound when a long turn ends, and another when Claude is waiting for your permission |
| [side-question](#side-question) | `/btw` asks a side question without stopping the work. The answer goes to a pane, not into the conversation |
| [session-diff](#session-diff) | Lists the files this session edited with their line counts, and shows each file's diff |
| [pr-pane](#pr-pane) | Shows open pull requests and their CI results in the status line and a pane |
| [usage-meter](#usage-meter) | Shows each turn's tokens and cache rate in the status line, and charts them over the session |
| [auto-worktree](#auto-worktree) | Creates a git worktree and moves the session into it when you send the session's first prompt, so work starts without editing the main checkout directly |

The mods' messages (toasts, status lines, panes, command output) are in Japanese.

## Requirements

- Developed and tested with Claude Code 2.1.289. The mod API (function hooks) is in early access, so a Claude Code update may break these mods
- branch-watch, session-diff and auto-worktree need git
- pr-pane needs the [GitHub CLI](https://cli.github.com/) (`gh`), signed in with `gh auth login`
- done-chime plays sounds on macOS only. On other systems it shows toasts without sound

## Install

```sh
claude plugin marketplace add yut0takagi/mods
claude plugin install branch-watch@yut0takagi-mods
claude plugin install push-gate@yut0takagi-mods
claude plugin install ja-check@yut0takagi-mods
claude plugin install done-chime@yut0takagi-mods
claude plugin install side-question@yut0takagi-mods
claude plugin install session-diff@yut0takagi-mods
claude plugin install pr-pane@yut0takagi-mods
claude plugin install usage-meter@yut0takagi-mods
claude plugin install auto-worktree@yut0takagi-mods
```

Install only the mods you want. To load them into a running session, run `/reload-plugins`. To update, run `claude plugin update <mod>@yut0takagi-mods`.

## branch-watch

When several sessions work in the same worktree, one session can switch the branch without the other noticing, and the other then commits to the wrong branch. branch-watch prevents this. It also lists which session works on which branch of which worktree.

- Remembers the branch a worktree was on when the session started working there, as that worktree's baseline
- Shows the `⎇ worktree / branch` the session works in, in the status line. That is the worktree where the session last edited a file or ran a command, or the session's directory before it has done either. Work outside git (notes under `~/.claude`, say) does not move it
- When the branch differs from the baseline, the status line gets a `⚠` and names the baseline. When other sessions run in the same worktree, it adds their count, as in `👥 +1`
- Shows a toast once when the branch moves away from the baseline. It checks after every tool call and every 15 seconds
- Blocks `git commit` on a branch other than the baseline, and tells the model why
- When the session itself runs `git checkout`, `git switch` or `gh pr checkout`, the new branch becomes the baseline
- `/branch-watch` opens a pane listing the running sessions grouped by worktree: whether each is working or waiting, the start of its first prompt, and the first 8 characters of its session id. A session on a branch other than its baseline also shows the baseline, and a worktree with two or more sessions gets a `⚠`

| Command | What it does |
| --- | --- |
| `/branch-watch` | Opens the pane of sessions and replies with this session's baseline and current branch. When the pane cannot open, the reply carries the list |
| `/branch-watch accept` | Makes the current branch the baseline, when the switch was intended. Accepted only when typed by a person |

To build the list, each session writes its state to `~/.claude/branch-watch/sessions/<session id>.json` every 15 seconds (under `CLAUDE_CONFIG_DIR` when that is set). A session not written for 60 seconds counts as stopped and leaves the list, and files older than 10 minutes are removed. A session removes its own file when it ends.

**Limitations**: commits are detected from the command text. A command containing `git commit` is blocked, but a commit made through an alias or a script is not recognized. The directory a command runs in is read from `git -C <dir>` and a leading `cd <dir> &&`; otherwise the session's current directory is assumed. Only sessions with branch-watch installed appear in the list. A read-only command such as `git -C <dir> log` also moves the session's worktree there.

## push-gate

Blocks commands that should not run without a person's approval, such as `git push`, and lets each one through only after a person approves it. Approving takes a button press or a command typed by a person, so the model cannot approve on its own.

- When a gated command is about to run, push-gate blocks it and tells the model to ask for approval. A band above the prompt shows the command with **Approve** and **Reject** buttons
- **Approve** sends a prompt asking Claude to run the same command again, and lets that exact command through once. An approval that is not used expires after 10 minutes
- **Reject** sends a prompt telling Claude not to run the command
- A different command, such as the same push with `--force` added, needs its own approval

| Command | What it does |
| --- | --- |
| `/push-gate` | Shows the command waiting for approval |
| `/push-gate approve` | Approves it. Accepted only when typed by a person |
| `/push-gate reject` | Rejects it. Accepted only when typed by a person |

| Setting | Default | Meaning |
| --- | --- | --- |
| `commands` | `git push, gh pr merge` | Comma-separated. A command whose words appear in this order is gated. Options may sit between the first word and the rest, as in `git -C dir push` |

If your editor does not show the band above the prompt, approve with `/push-gate approve`. Like branch-watch, push-gate matches the command text, so a push made through an alias or a script is not recognized.

## ja-check

Even when told to reply in Japanese, Claude sometimes writes its closing summary in English after a long run of tool calls. ja-check checks how each reply opens when a turn ends.

- Shows a toast when the reply opens in English
- Decides on the first line whose language can be told. Code blocks, headings, tables, paths and URLs are skipped. A line with fewer than three English words (such as `OK`) does not decide
- Skips subagent replies and interrupted turns

| Setting `mode` | Behavior |
| --- | --- |
| `toast` (default) | Only shows a toast |
| `rewrite` | Sends one prompt asking Claude to rewrite the reply in Japanese. If the rewrite is in English too, it only shows a toast |

`rewrite` adds a turn for the rewrite, which uses tokens.

## done-chime

Lets you look away while Claude works: it plays a sound and shows a toast when a long turn ends.

- Notifies when a turn took `minSeconds` or longer, with how long it took
- Plays a different sound when Claude is waiting for your permission to use a tool
- Skips interrupted turns and subagent turns

| Setting | Default | Meaning |
| --- | --- | --- |
| `minSeconds` | `60` | Turns shorter than this are not notified |
| `sound` | `true` | Turn off to get toasts only |

## side-question

`/btw <question>` asks a question as a continuation of the conversation and shows the answer in a pane. Claude keeps working, and the answer is not added to the conversation, so Claude's context stays as it was.

- Runs at once, even while Claude is working on a turn
- The question goes to the same model over the conversation so far, so most of the input is read from the prompt cache. The pane shows how much was
- `/btw` alone opens the pane with an input field. Questions typed there leave nothing in the conversation. A question asked as `/btw <question>` leaves the command line itself in the conversation, as any slash command does
- The pane keeps the last 10 questions and answers

Each question is one more model request and uses tokens.

## session-diff

`/session-diff` opens a pane listing the files this session changed with Edit or Write, with the lines added and removed. Select a file to see its diff, or open a file's diff directly with `/session-diff <path>`.

- Shows changes not yet committed, against `HEAD`. A file git does not track is shown as entirely added
- Updates a file's counts each time it is edited. The **更新** (refresh) button updates them all

**Limitations**: files changed through Bash (`sed`, scripts and so on) are not listed. A diff longer than 10,000 characters shows only its first part.

## pr-pane

Fetches the open pull requests of the repository in the session's directory with `gh pr list` at a fixed interval (up to 30).

- Shows the count and a CI breakdown in the status line, for example `PR 3 ✗1 ○1 ✓1` (✗ failed, ○ running, ✓ passed)
- `/prs` opens the pane and fetches again. For each pull request the pane lists the CI result, the number (linked), the title, the branches, the author and the review state

| Setting | Default | Meaning |
| --- | --- | --- |
| `base` | empty | Only show pull requests into this branch (for example `main`). Empty shows all |
| `intervalSeconds` | `120` | Seconds between fetches. Never less than 30 |

`gh` calls the GitHub API as the signed-in account. Change `intervalSeconds` to call it less or more often.

## usage-meter

Shows the latest turn's tokens in the status line, for example `入力 52.1k / 出力 1.3k · キャッシュ 94% · 計 1.25M` (input, output, the share of input read from the prompt cache, and the session total). `/usage-meter` opens a pane with the trend over the session.

- Input includes the tokens read from and written to the prompt cache
- In the terminal, the pane draws one bar per turn: input read from the cache at the bottom, everything else on top. Other surfaces show a row of bar characters
- Subagent turns are not counted. The last 200 turns are kept

## auto-worktree

When you send a session's first prompt, auto-worktree creates a git worktree and moves the session into it, so work starts without editing the main checkout directly.

- Makes the same call Claude makes with EnterWorktree: it creates a worktree at `.claude/worktrees/<random name>` on the branch `worktree-<name>`. Where the branch starts and whether files such as `.env` are copied follow Claude Code's settings (`worktree.baseRef`, `.worktreeinclude`, `worktree.symlinkDirectories`)
- Shows a toast when the session moves, and tells the model by attaching a note to the first prompt. The VS Code and Cursor extension shows no toasts, so the model says so at the start of its first reply
- Does nothing for the second and later prompts, a resumed session, an unattended session such as `claude -p`, outside git, or when the session is already in a worktree
- A session started from the VS Code or Cursor extension runs without a screen of its own, so auto-worktree tells it is attended by its entrypoint (the environment variable `CLAUDE_CODE_ENTRYPOINT` is `claude-vscode`)
- When the session cannot move (you denied EnterWorktree, say), shows the reason in a toast and sends the prompt from the original directory
- The editor window keeps the original folder open. The worktree is created under its `.claude/worktrees/`, so you can open its files from there
- Adds `/.claude/worktrees/` to the clone's `.git/info/exclude` (a file that is never committed), so the worktrees do not show up in the main checkout's `git status`
- Never removes the worktrees it creates. Clean them up with ExitWorktree or `git worktree remove` when you are done
- In a session that has moved into a worktree, Claude Code refuses git commands whose target it cannot read. The [rtk](https://github.com/rtk-ai/rtk) hook rewrites `git status` to `rtk git status`, which would leave git unusable there. So before the rtk hook sees it, auto-worktree turns each `git` in command position of a Bash call into `\git`. The shell runs the same git, and Claude Code's permission rules still match it. rtk leaves that form alone, so inside the worktree git output is not compressed by rtk. Quoted text, `git` as an argument and here-document bodies are left unchanged. If `git` is an alias in your shell, note that `\git` skips the alias

| Command | What it does |
| --- | --- |
| `/auto-worktree` | Says whether this session meets the conditions to move into a worktree, and why |

## Using the mods in the VS Code or Cursor extension

The Claude Code 2.1.289 extension for VS Code (and Cursor) does not show the mods' toasts, status lines, panes or buttons. Sounds, command replies and notes attached for the model do get through, so in the extension the mods work as follows.

| Mod | In the extension |
| --- | --- |
| auto-worktree | The model says at the start of its first reply that the session moved into a worktree |
| branch-watch | `/branch-watch` replies with the baseline and the list. When the branch moves, the model says so in its reply (once per change) |
| push-gate | No approve button. Approve with `/push-gate approve`, or cancel with `/push-gate reject` |
| ja-check | The warning toast is not shown |
| done-chime | Plays the sounds only |
| side-question | `/btw` waits for the answer and puts it in the reply |
| session-diff | `/session-diff` replies with the list, and `/session-diff <path>` with that file's diff |
| pr-pane | `/prs` replies with the pull requests and their CI results |
| usage-meter | `/usage-meter` replies with the latest turn and the trend |

The model also reads command replies, so what they show stays in the conversation (side-question's answers included).

## Settings

Open `/config` to see each mod's settings.

## Development

```sh
git clone https://github.com/yut0takagi/mods
cd mods

claude --plugin-dir ./branch-watch     # load for this session only; reloads on save
claude plugin validate ./branch-watch  # validate the manifest and the hooks
claude plugin test ./branch-watch      # run tests/*.test.ts
```

Each mod is laid out like this:

```text
branch-watch/
├── .claude-plugin/plugin.json   # manifest
├── hooks/hooks.json             # points to the hooks module
├── hooks/register.ts            # the hooks
├── hooks/git.ts                 # logic that does not touch $ (kept apart for tests)
├── types/index.d.ts             # types of the values kept in $.state
└── tests/
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code writes when it loads the mod. After the first load, `tsc -p <mod>` type-checks it. `.claude-plugin/types/` is generated and is not committed.

## License

[MIT](LICENSE)
