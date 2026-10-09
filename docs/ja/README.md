# ドキュメント

[English](../README.md) | 日本語

このリポジトリにある Claude Code の mod 9 本の使い方をまとめています。Claude Code をふだん使っていて、mod を入れて試したい人に向けて書いています。mod を自分で直したい人は、[CONTRIBUTING](../../CONTRIBUTING.ja.md) から読んでください。

## 最初に読むのは 2 ページだけ

1. [はじめかた](getting-started.md): 入れ方、設定の変え方、外し方
2. [VS Code・Cursor の拡張機能で使うとき](editors.md): ターミナル以外で使う人だけ読んでください。拡張機能ではペインやボタンが出ないため、各 mod の使い方が変わります

あとは、使う mod のページを必要なときに開けば足ります。うまく動かないときは [困ったとき](troubleshooting.md) を見てください。

## mod ごとのページ

| mod | こんなときに |
| --- | --- |
| [branch-watch](mods/branch-watch.md) | 同じ worktree で複数のセッションを動かしていて、別のセッションの切り替えたブランチに commit してしまうのを防ぎたい |
| [push-gate](mods/push-gate.md) | `git push` や `gh pr merge` を、人が承認するまで実行させたくない |
| [auto-worktree](mods/auto-worktree.md) | セッションを始めるたびに、メインのチェックアウトとは別のワークツリーで作業させたい |
| [session-diff](mods/session-diff.md) | このセッションが何をどれだけ書き換えたかを、その場で見たい |
| [pr-pane](mods/pr-pane.md) | 開いている PR と CI の結果を、Claude Code から離れずに見たい |
| [side-question](mods/side-question.md) | 作業を止めずに、会話の文脈を踏まえた質問を 1 つだけしたい |
| [done-chime](mods/done-chime.md) | 長い作業が終わったときと、許可を求められたときに、音で知りたい |
| [ja-check](mods/ja-check.md) | 日本語で頼んだのに、締めの報告だけ英語になるのを見逃したくない |
| [usage-meter](mods/usage-meter.md) | ターンごとのトークン数と、プロンプトキャッシュの効き具合を見たい |

上の 4 つは git の操作を守ったり変えたりする mod で、残りは情報を見せるだけの mod です。後者は入れても Claude の動きを変えないので、気軽に試せます（ja-check の `rewrite` だけは例外で、日本語での書き直しを頼むプロンプトを送ります）。

## 用語

| 用語 | このドキュメントでの意味 |
| --- | --- |
| mod | Claude Code に関数フックで機能を足すプラグイン。ツールの呼び出しを止めたり、画面に情報を出したりできる。Claude Code 2.1.289 時点では early access の機能 |
| セッション | `claude` を起動してから終えるまでの 1 回の会話。拡張機能では 1 つのチャット |
| ターン | 人が 1 回プロンプトを送ってから、Claude が返答を終えるまで |
| worktree・ワークツリー | 1 つのリポジトリから作る、別の作業ディレクトリ（`git worktree`）。メインのチェックアウトも worktree の 1 つ |
| ステータス行 | ターミナルの Claude Code の入力欄の下に出る 1 行 |
| ペイン | ターミナルの右側などに開く、mod が描く区画 |
| 帯 | 入力欄の上に出る、mod が描く 1〜数行の区画。push-gate の承認ボタンはここに出る |
| トースト | 数秒で消える短い知らせ |
| 基準 | branch-watch が覚えている、その worktree の本来のブランチ |

## このドキュメントで分からないとき

GitHub の [Issues](https://github.com/yut0takagi/mods/issues) に書いてください。セキュリティにかかわる問題は Issue にせず、[SECURITY](../../SECURITY.md#日本語) の手順で知らせてください。
