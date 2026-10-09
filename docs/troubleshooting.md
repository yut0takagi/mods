# Troubleshooting

English | [日本語](ja/troubleshooting.md)

Listed by symptom. Read only the heading that matches.

## A mod does not load

If a mod's command (`/branch-watch` and so on) does not appear when you type `/`, check these in order.

1. Is the mod listed as enabled in `claude plugin list`? If not, install it as in [Getting started](getting-started.md)
2. In a session that was already running, did you run `/reload-plugins`?
3. Are hooks turned off in your settings? With `disableAllHooks` set to `true`, mods do not load either. When your organization's managed settings turn on `allowManagedHooksOnly`, mods you installed yourself do not run
4. If it still does not appear, start with `claude --debug` and search the debug log (`~/.claude/debug/<session id>.txt`) for the mod's name. A line such as `hooks module branch-watch@yut0takagi-mods loaded` means it loaded. If it failed to load, the reason is in the same log

Mods are an early access feature, and Claude Code can turn them off with a rollout switch. If the log says `hooks modules are turned off`, there is nothing to fix on your side. Update Claude Code and wait a while.

## Nothing shows in the extension

The extension does not draw mods' status lines, toasts, panes or buttons. The mods report through command replies instead, so use the commands listed in [Using the VS Code and Cursor extension](editors.md).

## push-gate stopped a command that does not push

push-gate decides by looking for `git push` (and the other configured commands) in the command text. It also stops a command that only mentions "git push" inside a commit message or a here-document. This is a known issue that has not been fixed yet.

As a workaround, write the message to a file and pass it with `git commit -F <file>`, so the command text no longer contains "git push". You can also approve the stopped command; an approval lets that one command through once.

## branch-watch stopped a commit

It stops a commit when the current branch differs from this session's baseline. Another session may have switched the branch, so check with `/branch-watch` first.

- To go back, run `git checkout <baseline branch>`
- If the switch was intended and you want to continue on the current branch, type `/branch-watch accept` in the prompt input

## git is refused inside a worktree

In a session isolated in a worktree, Claude Code refuses git commands when it cannot tell which directory they target. A hook that rewrites commands, such as [rtk](https://github.com/rtk-ai/rtk)'s, turns `git status` into `rtk git status`, which gets refused.

With auto-worktree installed, git is passed on as `\git`, which rtk leaves alone, so this refusal does not happen ([details](mods/auto-worktree.md#git-keeps-working-with-rtk-installed)). This also works when you entered the worktree another way, such as with `claude --worktree`, as long as auto-worktree is installed.

If the refusal says "Run the plain command", it goes through when Claude retries with a plain `git …`.

## pr-pane says it could not get the pull requests

The pane (or the reply to `/prs` in the extension) explains the cause.

| Cause | What to do |
| --- | --- |
| gh could not be started | Install the GitHub CLI and make sure it is on your PATH |
| gh is not logged in | Run `gh auth login` in a terminal, then refresh with `/prs` |
| Not a GitHub repository | Check that you are inside a git repository whose remote points to GitHub |
| Timed out (20 seconds) | Check your network, then refresh with `/prs` |

## done-chime makes no sound

- Sounds play on macOS only
- Check that the `sound` setting is not `false`
- The end-of-turn sound does not play for turns shorter than `minSeconds` (60 seconds by default), for turns you interrupted, or for subagent turns
- The permission sound plays regardless of how long the turn is

## ja-check does not react to an English reply

ja-check looks only at how a reply starts. It does not decide on a line with fewer than three English words (such as `OK` or `Done.`) or on code, heading, table, path or URL lines, and it gives up after three such lines in a row. If a reply starts in Japanese, switching to English later does not trigger it. It also skips subagent replies and interrupted turns.

## Something else

Open an [issue](https://github.com/yut0takagi/mods/issues). Including your Claude Code version (`claude --version`), whether you use the terminal or the extension, and your OS helps.
