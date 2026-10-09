# session-diff

English | [日本語](../ja/mods/session-diff.md)

Lists the files this session changed with Edit or Write, with the number of lines added and removed, and shows a file's diff when you pick it. `git status` shows every change in the repository; session-diff shows only the files this session touched. When several sessions work in the same repository, it tells you which changes are this session's.

## What the diff compares against

The diff is the uncommitted change from `HEAD`. Once you commit, that file's diff disappears.

- A file git does not track is shown as all added lines
- In a repository with no commits yet, it compares against an empty tree
- Line counts refresh every time the file is edited. If the open diff's file is edited, the diff refreshes too

## Commands

| Command | What it does |
| --- | --- |
| `/session-diff` | Opens a pane listing the edited files. The refresh button recounts them all |
| `/session-diff <path>` | Opens that file's diff directly |

The path can be the relative path shown in the list, an absolute path, or just the file name. If you pass a file this session did not edit, it says so and shows the list instead. It does not read that file.

## In the extension

With no pane, `/session-diff` puts the list in the reply and `/session-diff <path>` puts the diff in the reply. A diff in a reply stays in the conversation and uses Claude's context, so be careful when showing a large diff many times.

## Limitations

- Only files changed with Edit, Write or NotebookEdit are listed. Files changed through Bash (`sed`, scripts, `git checkout -- <file>` and so on) are not
- Edits that were denied or failed are not counted
- It remembers the last 100 files
- A diff longer than 10,000 characters is cut off after its start
