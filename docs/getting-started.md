# Getting started

English | [日本語](ja/getting-started.md)

How to install a mod, change its settings, and remove it. The steps use terminal commands, but you can do the same from `/plugin` inside a running `claude`.

## Requirements

- Developed and tested with Claude Code 2.1.289. The mod API (function hooks) is in early access, so a Claude Code update may break a mod
- branch-watch, session-diff and auto-worktree use git
- pr-pane uses the [GitHub CLI](https://cli.github.com/) (`gh`). Log in with `gh auth login` first
- done-chime plays sounds on macOS only. On other systems it shows toasts only

## 1. Add the marketplace

```sh
claude plugin marketplace add yut0takagi/mods
```

This registers the GitHub repository `yut0takagi/mods` as a marketplace named `yut0takagi-mods`. No mod runs yet.

## 2. Install the mods you want

```sh
claude plugin install branch-watch@yut0takagi-mods
```

Replace `branch-watch` with each mod you want, one command per mod. You do not need all of them. If you are unsure, start with the ones that do not change what Claude does (usage-meter, session-diff, done-chime and so on); nothing breaks if you decide you do not like them.

By default a mod is enabled for all your projects (scope `user`). To use it in one repository only, run the install inside that repository with `--scope`.

| Scope | Enabled for | Recorded in |
| --- | --- | --- |
| `user` (default) | all your projects | `~/.claude/settings.json` |
| `project` | everyone who works in the repository | the repository's `.claude/settings.json` (committed) |
| `local` | you, in that repository | the repository's `.claude/settings.local.json` (not committed) |

`project` installs the mod for your whole team. It suits mods that ask a person to approve, such as push-gate.

## 3. Load it into a running session

New sessions load the installed mods. To use a mod in a session that is already running, run `/reload-plugins` there.

To check that a mod loaded, type `/` and see whether its command (`/branch-watch`, `/prs` and so on) appears. If it does not, see [Troubleshooting](troubleshooting.md#a-mod-does-not-load).

## Change settings

Four mods have settings.

| Mod | Setting | Default |
| --- | --- | --- |
| push-gate | `commands`: commands that need approval | `git push, gh pr merge` |
| ja-check | `mode`: what to do when a reply starts in English | `toast` |
| done-chime | `minSeconds`: shortest turn to notify about, in seconds / `sound`: whether to play sounds | `60` / `true` |
| pr-pane | `base`: base branch / `intervalSeconds`: seconds between refreshes | empty / `120` |

There are three ways to change them.

- Open `/config` in a session. The mods' settings are listed there; this is the easiest way
- Run `claude plugin configure <mod>@yut0takagi-mods` in a terminal to see the current values and which ones are unset
- Pass them when installing with `--config`, for example `claude plugin install pr-pane@yut0takagi-mods --config base=main`

Each mod's page explains its settings.

## Update

```sh
claude plugin marketplace update yut0takagi-mods
claude plugin update branch-watch@yut0takagi-mods
```

The first line refreshes the marketplace's list; the second moves the mod to the new version. An update takes effect after you restart Claude Code. The [CHANGELOG](../CHANGELOG.md) lists the changes in each release.

## Turn off or remove

Use `disable` to turn a mod off for a while and `uninstall` when you no longer want it.

```sh
claude plugin disable push-gate@yut0takagi-mods     # turn off (turn on again with enable)
claude plugin uninstall push-gate@yut0takagi-mods   # remove
claude plugin marketplace remove yut0takagi-mods    # remove the marketplace too
```

Files the mods wrote stay after you remove them: branch-watch's session list (`~/.claude/branch-watch/`) and the worktrees auto-worktree created (under `.claude/worktrees/`). auto-worktree also adds one line to `.git/info/exclude`. You can delete all of these by hand.

## What to read next

- If you use the VS Code or Cursor extension: [Using the VS Code and Cursor extension](editors.md)
- Otherwise: the page of each mod you installed ([list](README.md#one-page-per-mod))
