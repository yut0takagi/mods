# mods

[English](README.md) | 日本語

Claude Code の mod を集めたマーケットプレイスです。mod は、関数フックで Claude Code に機能を足すプラグインです。

| mod | できること |
| --- | --- |
| [branch-watch](docs/ja/mods/branch-watch.md) | 別のセッションが切り替えたブランチでの commit を止め、セッションごとの worktree とブランチを一覧にする |
| [push-gate](docs/ja/mods/push-gate.md) | `git push` などを、人が承認するまで通さない |
| [auto-worktree](docs/ja/mods/auto-worktree.md) | 最初のプロンプトでワークツリーを作り、そこで作業を始める |
| [session-diff](docs/ja/mods/session-diff.md) | このセッションが編集したファイルと差分を出す |
| [pr-pane](docs/ja/mods/pr-pane.md) | 開いている PR と CI の結果を出す |
| [side-question](docs/ja/mods/side-question.md) | `/btw` で、作業を止めずに脇道の質問をする |
| [done-chime](docs/ja/mods/done-chime.md) | 長いターンの終わりと、許可待ちを音で知らせる |
| [ja-check](docs/ja/mods/ja-check.md) | 返答が英語で書き出されたら知らせる |
| [usage-meter](docs/ja/mods/usage-meter.md) | ターンごとのトークン数とキャッシュの割合を出す |

## インストール

```sh
claude plugin marketplace add yut0takagi/mods
claude plugin install branch-watch@yut0takagi-mods   # 使う mod ごとに 1 行
```

Claude Code 2.1.289 で開発しています。mod の機能は early access なので、Claude Code の更新で動かなくなることがあります。VS Code・Cursor の拡張機能では mod の画面が描かれないため、[使い方が変わります](docs/ja/editors.md)。

## ドキュメント

- [はじめかた](docs/ja/getting-started.md)（設定、更新、外し方）
- [困ったとき](docs/ja/troubleshooting.md)
- [ドキュメントの一覧](docs/ja/README.md)

直したい人は [CONTRIBUTING](CONTRIBUTING.ja.md) を、変更の履歴は [CHANGELOG](CHANGELOG.md) を見てください。セキュリティの問題は [SECURITY](SECURITY.md#日本語) の手順で知らせてください。

## ライセンス

[MIT](LICENSE)
