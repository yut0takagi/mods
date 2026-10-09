# pr-pane

English | [日本語](../ja/mods/pr-pane.md)

Shows the open pull requests of the repository in the session's directory, with their CI results, in the status line and a pane. After Claude opens a pull request, you can see whether CI passed without switching to the browser.

## Reading the status line

```text
PR 3 ✗1 ○1 ✓1
```

Three open pull requests: CI failed on one, is running on one, and passed on one. Pull requests with no CI are not counted in the breakdown.

A check counts as failed (✗) when its conclusion is `FAILURE`, `TIMED_OUT`, `CANCELLED`, `ACTION_REQUIRED`, `STARTUP_FAILURE` or `ERROR`. A pull request with any failed check is ✗; one with no failures but a check still running is ○.

## Commands

| Command | What it does |
| --- | --- |
| `/prs` | Opens the pane and refreshes right away |

For each pull request, the pane shows its CI result, its number (linked to the pull request), title, branches (`head → base`), author, whether it is a draft, and its review state.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `base` | empty | Show only pull requests into this base branch (for example `main` or `develop`). Empty shows all |
| `intervalSeconds` | `120` | Seconds between refreshes. Never less than 30 |

## Calls to GitHub

It runs `gh pr list --state open --limit 30`, which calls the GitHub API as the account `gh` is logged in with. It calls once every `intervalSeconds`, so 30 times an hour by default. Each call gives up after 20 seconds, and at most 30 pull requests are fetched.

When it cannot fetch them, see the causes and fixes in [Troubleshooting](../troubleshooting.md#pr-pane-says-it-could-not-get-the-pull-requests).

## In the extension

While there is no screen, it does not refresh on a timer, so it does not call the API for a display nobody sees. `/prs` fetches once and puts the result in the reply.
