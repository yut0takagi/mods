# Changelog

Notable changes to the mods in this repository. Each mod has its own version in its `plugin.json`; the headings below name the mods a release touches. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Documentation

- Moved the detailed usage of each mod from the README into `docs/` (English) and `docs/ja/` (Japanese), with pages for getting started, the VS Code and Cursor extension, and troubleshooting. The READMEs are now short entry points
- Added `CONTRIBUTING.md`, `SECURITY.md`, this changelog, and issue and pull request templates
- Added a code of conduct (Contributor Covenant 2.1, in English and Japanese)
- Each mod's `homepage` in `plugin.json` now points to its docs page instead of its folder

### Development

- Added a GitHub Actions workflow that validates, tests and type-checks every mod on Claude Code 2.1.294 and on the latest version

## 0.1.0 - 2026-10-09

First release of nine mods, all at version 0.1.0.

### Added

- **branch-watch**: shows `⎇ worktree / branch` in the status line, lists which session works on which branch of which worktree, and stops `git commit` on a branch another session switched to
- **push-gate**: stops `git push` and `gh pr merge` until a person approves, and lets the approved command through once
- **ja-check**: tells you when a reply starts in English, and can ask for a Japanese rewrite
- **done-chime**: plays a sound when a long turn ends and another when Claude is waiting for permission
- **side-question**: `/btw` asks a side question without stopping the work and shows the answer in a pane
- **session-diff**: lists the files this session edited with their line counts and shows each diff
- **pr-pane**: shows open pull requests and their CI results in the status line and a pane
- **usage-meter**: shows each turn's token counts and prompt cache rate, and charts them over the session
- **auto-worktree**: creates a git worktree and moves the session into it when the first prompt is sent. Inside the worktree it turns `git` into `\git`, so a hook that rewrites `git` to `rtk git` does not make Claude Code refuse every git command there
- In the VS Code and Cursor extension, which draws no mod UI, every mod reports through command replies or notes to the model
