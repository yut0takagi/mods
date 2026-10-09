# Contributing

English | [日本語](CONTRIBUTING.ja.md)

Bug reports, fixes and ideas for new mods are welcome. This page is for people who want to change a mod's code or docs. For how to use the mods, see the [docs](docs/README.md).

## Before you start

- Report bugs and request features in [Issues](https://github.com/yut0takagi/mods/issues). There are templates
- Discuss a new mod, or a change to how an existing mod behaves, in an issue before opening a pull request. Typos and small bug fixes can go straight to a pull request
- Do not report security problems as issues; follow [SECURITY](SECURITY.md)

## What you need

- Claude Code 2.1.289 or later
- git
- TypeScript 5 for type checks (being able to run it with `npx` is enough; there is no `package.json`)
- The GitHub CLI (`gh`) if you work on pr-pane

## Repository layout

```text
mods/
├── .claude-plugin/marketplace.json   # The marketplace catalog. Add new mods here too
├── <mod>/
│   ├── .claude-plugin/plugin.json    # Manifest (name, version, description, settings)
│   ├── hooks/hooks.json              # Points to the hooks module
│   ├── hooks/register.ts(x)          # The hooks. The only file that uses $
│   ├── hooks/<logic>.ts              # Decisions that do not touch $ (git.ts, judge.ts, ...)
│   ├── types/index.d.ts              # Types of values kept in $.state (only mods that use it)
│   ├── tests/                        # *.test.ts
│   └── tsconfig.json
├── docs/                             # English docs
└── docs/ja/                          # Japanese docs
```

`<mod>/.claude-plugin/types/` holds types Claude Code generates when it loads a mod. It is excluded in `.gitignore`.

## Run and check a mod

```sh
git clone https://github.com/yut0takagi/mods
cd mods

claude --plugin-dir ./branch-watch      # load it into this session only
claude plugin validate ./branch-watch   # validate the manifest and hooks
claude plugin test ./branch-watch       # run tests/*.test.ts
claude plugin validate .                # validate the marketplace catalog
```

Type-check after the mod has been loaded once, so that `.claude-plugin/types/` exists:

```sh
npx --yes --package=typescript@5 -- tsc -p ./branch-watch
```

`claude plugin test` sometimes stops with `hooks modules are turned off in this process: the rollout switch was saved off …`. The rollout switch for mods was saved as off by an earlier session. Start `claude` once with network access to refresh it, then run the tests again. If the same message comes back, mods are turned off on Claude Code's side.

## Code

Follow the existing mods. In particular:

- **Keep decisions away from `$`.** Decisions such as "is this command a commit?" or "should this session move into a worktree?" go in a separate file as functions that do not touch `$`, with their own unit tests. `register` only wires those functions to the engine
- **Work without a screen.** The VS Code and Cursor extension draws no status lines, toasts, panes or buttons. When `$.session.surfaces()` is empty, report through a command reply or a note to Claude instead (see the [extension page](docs/editors.md))
- **Check where human-only actions come from.** Actions Claude must not take, such as approving or changing a baseline, are accepted only when the command's `origin.kind` is `composer` or `bridge`
- **Never block the prompt on a failure.** When `$.process.run` or `$.fs.read` fails inside a mod, `catch` it and fall back to the original behavior (`next(e)`), so a bug in a mod does not stop the user's work
- **Comment on why.** Write why the code does something, not what it plainly does. Existing comments are in Japanese

## Tests

- Write at least one test for each behavior you add. Name the test with one sentence describing the behavior (existing names are in Japanese)
- Imitate the outside of the engine (git, files, screens) with the test's `on(...)`. Reproduce how the real tool behaves (for example, git cannot resolve `HEAD` in a repository without commits). A loose imitation hides bugs that only show up for real
- Run tests that draw UI on several screens, for example `['terminal', 'desktop'] as const`
- Also test the no-screen case (empty `surfaces`)

## Adding a mod

Put all of these in the same pull request:

- [ ] The `<mod>/` folder (`plugin.json`, `hooks/`, `tests/`, `tsconfig.json`)
- [ ] An entry in `.claude-plugin/marketplace.json`
- [ ] A row in the tables of `README.md` and `README.ja.md`
- [ ] `docs/mods/<mod>.md` and `docs/ja/mods/<mod>.md`
- [ ] A row in the tables of `docs/editors.md` and `docs/ja/editors.md` (how it works in the extension)
- [ ] An entry in `CHANGELOG.md`

## Docs

Update the English (`docs/`) and Japanese (`docs/ja/`) docs in the same pull request. If you can write only one language, say so in the pull request and the maintainer will add the other.

## Versions and the changelog

Each mod has its own version ([Semantic Versioning](https://semver.org/)). When you change behavior, raise `version` in both `plugin.json` and `marketplace.json` to the same value, and add an entry to `CHANGELOG.md`. Docs-only changes do not change versions.

## Commits and pull requests

- Write commit messages as `type(mod): summary`, where type is one of `feat`, `fix`, `docs`, `test`, `refactor` and `chore`. Example: `fix(session-diff): show diffs in a repository with no commits`
- Before opening a pull request, run `claude plugin validate`, `claude plugin test` and the type check for each mod you touched
- Fill in the checklist in the pull request template

## License

Code and docs you send in a pull request are published under the same [MIT License](LICENSE) as this repository.
