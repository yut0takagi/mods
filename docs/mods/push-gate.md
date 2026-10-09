# push-gate

English | [日本語](../ja/mods/push-gate.md)

Stops commands you do not want to run without a person checking first, such as `git push` and `gh pr merge`, and lets each one through once when a person approves. Approval only comes from a button or a command a person types into the prompt input, so Claude cannot approve its own command.

Claude Code's permission settings (`permissions.ask`) can also ask before a command runs, but in a mode that skips permission prompts (`--dangerously-skip-permissions` and the like) that question never appears. push-gate stops the tool call before the permission check, so it is expected to stop the command in that mode too (not tested in that mode).

## How approval works

1. When Claude tries to run a matching command, push-gate stops it and tells Claude to ask you for approval and end the turn
2. A band above the prompt input shows the stopped command with Approve and Reject buttons
3. Approve sends a prompt asking Claude to run the same command again, and that command goes through once
4. Reject sends a prompt telling Claude not to run the command

An approval only covers the exact command text that was stopped. If Claude changes it, for example by adding `--force`, it needs approval again. An unused approval expires after 10 minutes.

## Commands

| Command | What it does |
| --- | --- |
| `/push-gate` | Shows the command waiting for approval |
| `/push-gate approve` | Approves it. Accepted only when a person types it |
| `/push-gate reject` | Rejects it. Accepted only when a person types it |

Where the band is not shown (in the extension, for example), use `/push-gate approve` and `/push-gate reject`. Writing "approved" in the chat does not approve anything.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `commands` | `git push, gh pr merge` | Commands that need approval, separated by commas |

Each entry is matched as a sequence of words: `git push` stops a command where `push` follows `git`. Options in between still match, so `git -C ../repo push` is stopped too.

An example that adds more commands:

```text
git push, gh pr merge, gh release create, npm publish
```

## Limitations

- It decides by the command text, so it cannot see a push made through an alias or a script
- It stops a command if the words appear anywhere in its text. Just writing "git push" inside a commit message or a here-document stops it (a known issue; see the workaround in [Troubleshooting](../troubleshooting.md#push-gate-stopped-a-command-that-does-not-push))
- Only one command waits for approval at a time. When another command is stopped, it replaces the one waiting
