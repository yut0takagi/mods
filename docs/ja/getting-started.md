# はじめかた

[English](../getting-started.md) | 日本語

mod を入れ、設定を変え、要らなくなったら外すまでの手順です。手順はターミナルのコマンドで書いていますが、`claude` を起動したあとの `/plugin` からも同じことができます。

## 動作環境

- Claude Code 2.1.289 で開発し、テストしています。mod の API（関数フック）は early access なので、Claude Code の更新で動かなくなることがあります
- branch-watch、session-diff、auto-worktree は git を使います
- pr-pane は [GitHub CLI](https://cli.github.com/)（`gh`）を使います。先に `gh auth login` でログインしておいてください
- done-chime の音が鳴るのは macOS だけです。ほかの OS ではトーストだけで知らせます

## 1. マーケットプレイスを登録する

```sh
claude plugin marketplace add yut0takagi/mods
```

GitHub の `yut0takagi/mods` を、`yut0takagi-mods` という名前のマーケットプレイスとして登録します。登録しただけでは、どの mod も動きません。

## 2. 使う mod を入れる

```sh
claude plugin install branch-watch@yut0takagi-mods
```

`branch-watch` の部分を入れたい mod の名前に変えて、1 本ずつ入れます。全部入れる必要はありません。迷ったら、Claude の動きを変えない mod（usage-meter、session-diff、done-chime など）から試すと、合わなかったときも困りません。

既定では、自分のすべてのプロジェクトで有効になります（スコープ `user`）。1 つのリポジトリだけで使いたいときは、そのリポジトリの中で `--scope` を付けます。

| スコープ | 有効になる範囲 | 記録される場所 |
| --- | --- | --- |
| `user`（既定） | 自分のすべてのプロジェクト | `~/.claude/settings.json` |
| `project` | そのリポジトリで作業する全員 | リポジトリの `.claude/settings.json`（commit される） |
| `local` | そのリポジトリでの自分だけ | リポジトリの `.claude/settings.local.json`（commit されない） |

`project` はチームの全員に mod を入れることになります。push-gate のように人の承認を求める mod をチームで使うときに向いています。

## 3. 起動中のセッションに読み込む

新しく起動したセッションには、入れた mod が読み込まれます。すでに動いているセッションで使いたいときは、そのセッションで `/reload-plugins` を実行します。

読み込まれたかどうかは、mod のコマンド（`/branch-watch`、`/prs` など）が入力欄の補完に出るかで確かめられます。出ないときは [困ったとき](troubleshooting.md#mod-が読み込まれない) を見てください。

## 設定を変える

設定項目があるのは 4 本です。

| mod | 設定 | 既定 |
| --- | --- | --- |
| push-gate | `commands`: 承認が要るコマンド | `git push, gh pr merge` |
| ja-check | `mode`: 英語で書き出されたときの動き | `toast` |
| done-chime | `minSeconds`: 知らせるターンの長さ（秒）／`sound`: 音を鳴らすか | `60`／`true` |
| pr-pane | `base`: 宛先ブランチ／`intervalSeconds`: 取り直す間隔（秒） | 空／`120` |

変え方は 3 通りあります。

- セッションの中で `/config` を開くと、mod の設定が一覧に並びます。ここで変えるのがいちばん手軽です
- ターミナルで `claude plugin configure <mod>@yut0takagi-mods` を実行すると、今の値とまだ設定していない項目が出ます
- 入れるときに `--config` で渡すこともできます。例: `claude plugin install pr-pane@yut0takagi-mods --config base=main`

各項目の意味は mod のページに書いています。

## 更新する

```sh
claude plugin marketplace update yut0takagi-mods
claude plugin update branch-watch@yut0takagi-mods
```

1 行目でマーケットプレイスの一覧を取り直し、2 行目で mod を新しい版にします。更新は Claude Code を起動し直すと効きます。版ごとの変更点は [CHANGELOG](../../CHANGELOG.md) にまとめています。

## 止める・外す

一時的に止めるなら `disable`、要らなくなったら `uninstall` です。

```sh
claude plugin disable push-gate@yut0takagi-mods     # 止める（enable で戻せる）
claude plugin uninstall push-gate@yut0takagi-mods   # 外す
claude plugin marketplace remove yut0takagi-mods    # マーケットプレイスの登録も消す
```

mod が自分で書いたファイルは、外しても残ります。残るのは branch-watch のセッション一覧（`~/.claude/branch-watch/`）と、auto-worktree が作ったワークツリー（`.claude/worktrees/` の下）です。auto-worktree は `.git/info/exclude` にも 1 行足しています。どれも手で消してかまいません。

## 次に読むもの

- VS Code か Cursor の拡張機能で使うなら、次は [VS Code・Cursor の拡張機能で使うとき](editors.md)
- それ以外の人は、入れた mod のページ（[一覧](README.md#mod-ごとのページ)）
