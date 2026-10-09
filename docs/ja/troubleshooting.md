# 困ったとき

[English](../troubleshooting.md) | 日本語

症状から引けるように並べています。当てはまる見出しだけを読んでください。

## mod が読み込まれない

mod のコマンド（`/branch-watch` など）が補完に出ないときは、次の順に確かめます。

1. `claude plugin list` に、その mod が有効（enabled）で出ているか。出ていなければ [はじめかた](getting-started.md) の手順で入れる
2. 起動中のセッションなら `/reload-plugins` を実行したか
3. 設定で hook が止められていないか。`disableAllHooks` が `true` だと、mod も読み込まれない。会社の管理設定で `allowManagedHooksOnly` が有効なときも、自分で入れた mod は動かない
4. それでも出ないときは、`claude --debug` で起動して、デバッグログ（`~/.claude/debug/<セッション id>.txt`）を mod の名前で検索する。`hooks module branch-watch@yut0takagi-mods loaded` の行があれば読み込まれている。読み込めなかったときは、その理由が同じログに出る

mod の機能は early access で、Claude Code 側の配布スイッチで止められることがあります。ログに `hooks modules are turned off` と出ているときは、こちらからは直せません。Claude Code を最新にして、しばらく待ってください。

## 拡張機能で何も表示されない

拡張機能は、mod のステータス行・トースト・ペイン・ボタンを描きません。コマンドの返答で内容を出す作りにしているので、[VS Code・Cursor の拡張機能で使うとき](editors.md) の表のとおりにコマンドを打ってください。

## push-gate に止められたが、push はしていない

push-gate は、コマンドの文字列に `git push` などが含まれているかで判断します。commit メッセージやヒアドキュメントの中に「git push」と書いてあるだけでも止まります。既知の問題で、まだ直していません。

その場では、メッセージをファイルに書いて `git commit -F <ファイル>` で渡すと、コマンドの文字列から「git push」が消えるので止まりません。止められたコマンドを承認して通してもかまいません。承認は、そのコマンドを 1 回通すだけです。

## branch-watch に commit を止められた

このセッションの基準と、今のブランチが違うときに止めます。別のセッションがブランチを切り替えた可能性があるので、まず `/branch-watch` で状況を見てください。

- 元のブランチに戻すなら `git checkout <基準のブランチ>`
- 切り替えが意図したもので、今のブランチで続けるなら、入力欄で `/branch-watch accept`

## ワークツリーの中で git が拒否される

Claude Code は、ワークツリーに隔離されたセッションで、どのディレクトリを対象にするか読み取れない git を拒否します。[rtk](https://github.com/rtk-ai/rtk) のようにコマンドを書き換えるフックを入れていると、`git status` が `rtk git status` になり、拒否されます。

auto-worktree を入れていれば、git を rtk が書き換えない `\git` にしてから渡すので、この拒否は起きません（[詳しく](mods/auto-worktree.md#rtk-を入れていても-git-が使える)）。auto-worktree を使わずに `claude --worktree` などでワークツリーに入った場合でも、auto-worktree を入れておけば同じように効きます。

拒否の文面に「Run the plain command」とあるときは、Claude が素の `git …` で打ち直せば通ります。

## pr-pane に「PR を取れませんでした」と出る

ペイン（拡張機能では `/prs` の返答）に、原因ごとの説明が出ます。

| 原因 | 対処 |
| --- | --- |
| gh を起動できない | GitHub CLI を入れ、PATH が通っているかを確かめる |
| gh にログインしていない | ターミナルで `gh auth login` を実行し、`/prs` で取り直す |
| GitHub のリポジトリではない | git のリポジトリの中で、remote が GitHub を向いているかを確かめる |
| 時間切れ（20 秒） | ネットワークを確かめ、`/prs` で取り直す |

## done-chime が鳴らない

- 音が鳴るのは macOS だけです
- 設定の `sound` が `false` になっていないか確かめてください
- ターンの終わりの音は、`minSeconds`（既定 60 秒）より短いターンでは鳴りません。自分で中断したターンと、サブエージェントのターンでも鳴りません
- 許可を求める音は、ターンの長さに関係なく鳴ります

## ja-check が英語の返答に反応しない

ja-check は返答の書き出しだけを見ます。英単語が 3 語に満たない行（`OK` や `Done.` など）と、コード・見出し・表・パス・URL の行では言語を決めず、そうした行が 3 行続くと判断をやめます。書き出しが日本語なら、途中から英語になっても反応しません。サブエージェントの返答と、中断したターンも見ません。

## ここにない問題

[Issues](https://github.com/yut0takagi/mods/issues) に書いてください。Claude Code の版（`claude --version`）、ターミナルか拡張機能か、OS を添えてもらえると調べやすくなります。
