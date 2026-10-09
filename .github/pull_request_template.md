## What and why / 何を、なぜ

<!-- Link the issue if there is one. / Issue があればリンクしてください -->

## Checks / 確認

- [ ] `claude plugin validate ./<mod>` passes for each mod I touched / 触った mod の validate が通る
- [ ] `claude plugin test ./<mod>` passes, with tests for the new behavior / test が通り、足した動きのテストがある
- [ ] Type check passes / 型検査が通る (`npx --yes --package=typescript@5 -- tsc -p ./<mod>`)
- [ ] It also works with no screen (VS Code / Cursor extension) / 画面のないセッション（拡張機能）でも伝わる
- [ ] `docs/` and `docs/ja/` are updated together (or I said which one I could not write) / 英日の docs を両方直した（書けなかったほうを明記した）
- [ ] `version` in `plugin.json` and `marketplace.json`, and `CHANGELOG.md`, are updated if behavior changed / 動きを変えたなら版と CHANGELOG を更新した
