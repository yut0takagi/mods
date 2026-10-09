# mods

[English](README.md) | 日本語

Claude Code の mod を集めたプラグインのマーケットプレイスです。mod は Claude Code に関数フックで機能を足すプラグインで、ツール呼び出しを止めたり、ステータス行やペインに情報を出したりできます。

| mod | できること |
| --- | --- |
| [branch-watch](#branch-watch) | ステータス行に `⎇ worktree / branch` を出し、どのセッションがどの worktree のどのブランチで作業しているかをペインに並べる。別のセッションがブランチを切り替えたら知らせ、そのブランチでの `git commit` を止める |
| [push-gate](#push-gate) | `git push` などを止め、人が承認ボタンを押すまで通さない。モデルは自分で承認できない |
| [ja-check](#ja-check) | 返答が英語で書き出されたら知らせる。日本語での書き直しを頼むこともできる |
| [done-chime](#done-chime) | 長いターンが終わったら音で知らせる。許可を待っているときは別の音を鳴らす |
| [side-question](#side-question) | `/btw` で、作業を止めずに脇道の質問をする。答えはペインに出て、会話には残らない |
| [session-diff](#session-diff) | このセッションで編集したファイルと増減を並べ、ファイルごとの差分を出す |
| [pr-pane](#pr-pane) | 開いている PR と CI の結果をステータス行とペインに出す |
| [usage-meter](#usage-meter) | ターンごとのトークン数とキャッシュの割合をステータス行に出し、推移をグラフにする |
| [auto-worktree](#auto-worktree) | セッションの最初のプロンプトを送ったときに、git のワークツリーを作ってそこへ移る。メインのチェックアウトを直接書き換えずに作業を始められる |

## 動作環境

- Claude Code 2.1.289 で開発し、テストしています。mod の API（関数フック）は early access のため、Claude Code の更新で動かなくなることがあります
- branch-watch、session-diff、auto-worktree には git が要ります
- pr-pane には [GitHub CLI](https://cli.github.com/)（`gh`）が要ります。`gh auth login` でログインしておいてください
- done-chime の音が鳴るのは macOS だけです。ほかの OS ではトーストだけで知らせます

## インストール

```sh
claude plugin marketplace add yut0takagi/mods
claude plugin install branch-watch@yut0takagi-mods
claude plugin install push-gate@yut0takagi-mods
claude plugin install ja-check@yut0takagi-mods
claude plugin install done-chime@yut0takagi-mods
claude plugin install side-question@yut0takagi-mods
claude plugin install session-diff@yut0takagi-mods
claude plugin install pr-pane@yut0takagi-mods
claude plugin install usage-meter@yut0takagi-mods
claude plugin install auto-worktree@yut0takagi-mods
```

必要な mod だけ入れてもかまいません。起動中のセッションに読み込むときは `/reload-plugins` を実行します。更新するときは `claude plugin update <mod>@yut0takagi-mods` を実行します。

## branch-watch

同じ worktree で複数のセッションを並行して動かしていると、片方のセッションがブランチを切り替えたことにもう片方が気づかず、意図しないブランチに commit してしまうことがあります。branch-watch はこれを防ぎます。また、どのセッションがどの worktree のどのブランチで作業しているかを一覧にします。

- セッションが worktree で作業を始めたときのブランチを、その worktree の「基準」として覚えます
- ステータス行に、このセッションが作業している `⎇ worktree / branch` を出します。作業している worktree とは、最後にファイルを編集したか、コマンドを実行した worktree です。まだ何もしていなければセッションのディレクトリを使います。git の外（`~/.claude` のメモなど）での作業では切り替えません
- 基準と違うブランチになっていればステータス行に `⚠` を付け、基準のブランチ名も添えます。同じ worktree でほかのセッションも動いていれば、`👥 +1` のように人数を足します
- 基準と違うブランチになったら、トーストで一度だけ知らせます。ツール呼び出しのたびと、15 秒ごとに確かめます
- 基準と違うブランチで `git commit` が実行されそうになったら止めます。止めた理由はモデルに伝わります
- セッション自身が `git checkout`・`git switch`・`gh pr checkout` を実行した場合は、切り替え先を新しい基準にします
- `/branch-watch` を実行すると、動いているセッションを worktree ごとにまとめたペインを開きます。各セッションについて、作業中か待機中か、最初のプロンプトの書き出し、session id の先頭 8 文字を出します。基準と違うブランチにいるセッションには基準も添えます。同じ worktree に 2 つ以上のセッションがいれば `⚠` を付けます

| コマンド | 動き |
| --- | --- |
| `/branch-watch` | セッションの一覧のペインを開き、このセッションの基準と今のブランチを返す。ペインを開けないときは、一覧を返答に出す |
| `/branch-watch accept` | 今のブランチを基準にする（切り替えが意図したものだったとき）。人が入力したときだけ受け付ける |

一覧を作るため、各セッションは自分の様子を `~/.claude/branch-watch/sessions/<session id>.json` に 15 秒ごとに書きます（`CLAUDE_CONFIG_DIR` を設定していればその下）。60 秒書かれていないセッションは止まったとみなして一覧から外し、10 分を過ぎたファイルは消します。セッションが終わるときは自分のファイルを消します。

**制限**: commit かどうかはコマンドの文字列から判断します。`git commit` を含むコマンドは止めますが、エイリアスやスクリプトを経由した commit は見分けられません。コマンドを実行するディレクトリは `git -C <dir>` と先頭の `cd <dir> &&` から読み、それ以外はセッションの今のディレクトリとみなします。一覧に出るのは branch-watch を入れたセッションだけです。読み取りだけのコマンド（`git -C <dir> log` など）でも、作業している worktree はそこに移ります。

## push-gate

`git push` のように人の承認なしに実行したくないコマンドを止め、人が承認したときだけ 1 回通します。承認にはボタンを押すか、人がコマンドを入力する必要があるため、モデルが自分で承認することはできません。

- 対象のコマンドが実行されそうになったら止め、承認を頼むようモデルに伝えます。入力欄の上の帯に、そのコマンドと「承認」「却下」のボタンを出します
- 「承認」を押すと、同じコマンドをもう一度実行するよう頼むプロンプトを送り、そのコマンドを 1 回だけ通します。使われなかった承認は 10 分で切れます
- 「却下」を押すと、そのコマンドを実行しないよう伝えるプロンプトを送ります
- `--force` を足すなどして中身が変わったコマンドは、改めて承認が要ります

| コマンド | 動き |
| --- | --- |
| `/push-gate` | 承認を待っているコマンドを表示する |
| `/push-gate approve` | 承認する。人が入力したときだけ受け付ける |
| `/push-gate reject` | 却下する。人が入力したときだけ受け付ける |

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `commands` | `git push, gh pr merge` | カンマ区切り。各項目の語が順に並ぶコマンドを止める。`git -C dir push` のように、最初の語のあとにオプションが挟まってもよい |

エディタで入力欄の上の帯が表示されないときは、`/push-gate approve` で承認します。判断は branch-watch と同じくコマンドの文字列で行うため、エイリアスやスクリプトを経由した push は見分けられません。

## ja-check

日本語で返答するよう指示していても、ツールを何度も使ったあとの締めの報告だけ英語になることがあります。ja-check はターンが終わるたびに返答の書き出しを確かめます。

- 書き出しが英語なら、トーストで知らせます
- 判断に使うのは、言語を決められる最初の行です。コードブロック・見出し・表・パス・URL は読み飛ばします。英単語が 3 語に満たない行（`OK` など）では決めません
- サブエージェントの返答と、中断したターンは確かめません

| 設定 `mode` | 動き |
| --- | --- |
| `toast`（既定） | 知らせるだけ |
| `rewrite` | 日本語で書き直すよう、プロンプトを一度だけ送る。書き直しも英語なら、それ以上は送らず知らせるだけにする |

`rewrite` は書き直しのためにターンを 1 回足すので、そのぶんトークンを使います。

## done-chime

長いターンが終わったら、音とトーストで知らせます。Claude が作業しているあいだ、画面から離れていられます。

- かかった時間が `minSeconds` 以上のターンが終わったら、その時間を添えて知らせます
- ツールを使う許可を Claude が待っているときは、別の音を鳴らします
- 中断したターンと、サブエージェントのターンでは知らせません

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `minSeconds` | `60` | これより短いターンでは知らせない |
| `sound` | `true` | オフにするとトーストだけで知らせる |

## side-question

`/btw <質問>` で、会話の続きとして質問し、答えをペインに出します。Claude は作業を続けたままで、答えは会話に足されないため、Claude が持つ文脈は変わりません。

- Claude がターンの途中でも、すぐに聞けます
- 質問は、ここまでの会話を前提に同じモデルへ送るため、入力の大半はプロンプトキャッシュから読まれます。その割合もペインに出します
- `/btw` だけを入力すると、入力欄のあるペインが開きます。そこで聞いた質問は会話に何も残しません。`/btw <質問>` の形で聞いた場合は、ほかのスラッシュコマンドと同じく、入力したコマンドの行が会話に残ります
- ペインには直近 10 件の質問と答えを残します

質問のたびにモデルへのリクエストが 1 回増え、そのぶんトークンを使います。

## session-diff

`/session-diff` でペインを開き、このセッションが Edit や Write で変えたファイルを、増えた行数・減った行数とともに並べます。ファイルを選ぶと差分を表示します。`/session-diff <パス>` で、そのファイルの差分を直接開くこともできます。

- `HEAD` からの、まだ commit していない変更を出します。git が追跡していないファイルは、すべて増えた行として出します
- ファイルを編集するたびに、そのファイルの行数を新しくします。「更新」ボタンを押すと、すべてを新しくします

**制限**: Bash（`sed` やスクリプトなど）で変えたファイルは並びません。10,000 文字を超える差分は、先頭だけを表示します。

## pr-pane

セッションのディレクトリにあるリポジトリについて、開いている PR を `gh pr list` で定期的に取得します（最大 30 件）。

- ステータス行に件数と CI の内訳を出します（例: `PR 3 ✗1 ○1 ✓1`）。✗ は失敗、○ は実行中、✓ は成功です
- `/prs` でペインを開き、その場で取り直します。ペインには PR ごとに CI の結果、番号（PR へのリンク）、タイトル、ブランチ、作成者、レビューの状態を並べます

| 設定 | 既定 | 意味 |
| --- | --- | --- |
| `base` | 空 | この宛先ブランチの PR だけを出す（例: `main`）。空ならすべての PR |
| `intervalSeconds` | `120` | 取り直す間隔（秒）。30 秒未満にはならない |

`gh` はログイン中のアカウントで GitHub の API を呼びます。呼ぶ頻度は `intervalSeconds` で変えられます。

## usage-meter

直近のターンのトークン数を、ステータス行に `入力 52.1k / 出力 1.3k · キャッシュ 94% · 計 1.25M` の形で出します（入力、出力、入力のうちプロンプトキャッシュから読んだ割合、セッションの合計）。`/usage-meter` で、セッション中の推移をペインに出します。

- 入力には、プロンプトキャッシュから読んだ分と書いた分を含めます
- ターミナルでは、ターンごとに 1 本の棒グラフを描きます。下がキャッシュから読んだ入力、その上がそれ以外です。ほかの画面では、棒の形の文字を 1 行に並べます
- サブエージェントのターンは数えません。直近 200 ターンを残します

## auto-worktree

セッションの最初のプロンプトを送ったときに、git のワークツリーを作ってそこへ移ります。メインのチェックアウトを直接書き換えずに作業を始められます。

- Claude が EnterWorktree を呼ぶのと同じ呼び出しで、`.claude/worktrees/<ランダムな名前>` にワークツリーを作り、ブランチ `worktree-<名前>` で作業を始めます。どこから枝分かれするかと、`.env` などをコピーするかは、Claude Code の設定（`worktree.baseRef`、`.worktreeinclude`、`worktree.symlinkDirectories`）に従います
- 移ったことはトーストで知らせ、最初のプロンプトに添えてモデルにも伝えます。VS Code・Cursor の拡張機能ではトーストが出ないので、モデルが最初の返答の冒頭で知らせます
- 2 通目以降のプロンプト、再開したセッション、`claude -p` のような人のいないセッション、git の外、すでにワークツリーの中にいるときは何もしません
- VS Code・Cursor の拡張機能から始めたセッションは画面のないセッションとして動くので、起動元（環境変数 `CLAUDE_CODE_ENTRYPOINT` が `claude-vscode`）で人がいると判断します
- 入れなかったとき（EnterWorktree を許可しなかった、など）は理由をトーストで出し、プロンプトは元の場所でそのまま送ります
- エディタのウィンドウは元のフォルダを開いたままです。ワークツリーはその中の `.claude/worktrees/` にできるので、ファイルはそこから開けます
- 作ったワークツリーがメインのチェックアウトの `git status` に出ないよう、そのクローンの `.git/info/exclude`（コミットされないファイル）に `/.claude/worktrees/` を足します
- 作ったワークツリーは消しません。使い終わったら ExitWorktree か `git worktree remove` で片づけます
- ワークツリーに入ったセッションでは、Claude Code がどこで動くか読めない git を拒否します。[rtk](https://github.com/rtk-ai/rtk) のフックは `git status` を `rtk git status` に書き換えるので、そのままだと git が使えません。そこで、Claude が走らせる Bash のうちコマンドの位置にある `git` を、rtk のフックが届く前に `\git` にします。シェルにとっては同じ git で、Claude Code の権限ルールもそのまま当たります。rtk はこの形を書き換えないので、ワークツリーの中の git だけ rtk の出力の圧縮が効かなくなります。引用符の中、引数の git、ヒアドキュメントの中身は変えません。`git` をエイリアスにしている場合、`\git` はエイリアスを通らない点に注意してください

| コマンド | 内容 |
| --- | --- |
| `/auto-worktree` | このセッションがワークツリーに入る条件を満たすかどうかと、その理由を出す |

## VS Code・Cursor の拡張機能で使うとき

Claude Code 2.1.289 の VS Code 拡張機能（Cursor でも同じ）は、mod のトースト・ステータス行・ペイン・ボタンを表示しません。音、コマンドの返答、モデルへの添え書きは届くので、この環境では各 mod が次のように動きます。

| mod | 拡張機能での動き |
| --- | --- |
| auto-worktree | ワークツリーに移ったことを、モデルが最初の返答の冒頭で知らせる |
| branch-watch | `/branch-watch` の返答に基準と一覧を出す。ブランチのずれは、モデルが返答で知らせる（同じずれは 1 回だけ） |
| push-gate | 承認ボタンは出ない。`/push-gate approve` で承認し、`/push-gate reject` で取りやめる |
| ja-check | 知らせのトーストは出ない |
| done-chime | 音だけで知らせる |
| side-question | `/btw` が答えを待って、返答に出す |
| session-diff | `/session-diff` で一覧を、`/session-diff <パス>` でそのファイルの差分を返答に出す |
| pr-pane | `/prs` で PR と CI の状態を返答に出す |
| usage-meter | `/usage-meter` で直近のターンと推移を返答に出す |

コマンドの返答はモデルも読みます。そのため、返答に出した内容は会話に残ります（side-question の答えも残ります）。

## 設定の変え方

`/config` を開くと、各 mod の設定が一覧に並びます。

## 開発

```sh
git clone https://github.com/yut0takagi/mods
cd mods

claude --plugin-dir ./branch-watch   # このセッションだけ読み込む。保存するたびに読み込み直す
claude plugin validate ./branch-watch   # マニフェストとフックを検証する
claude plugin test ./branch-watch       # tests/*.test.ts を実行する
```

1 つの mod は次のファイルからなります。

```text
branch-watch/
├── .claude-plugin/plugin.json   # マニフェスト
├── hooks/hooks.json             # フックのモジュールを指す
├── hooks/register.ts            # フック本体
├── hooks/git.ts                 # $ に触れない処理（テストしやすいよう分けている）
├── types/index.d.ts             # $.state に置く値の型
└── tests/
```

`tsconfig.json` は、Claude Code が mod を読み込むときに置く `.claude-plugin/types/tsconfig.json` を継承します。一度読み込んだあとは `tsc -p <mod>` で型を確かめられます。`.claude-plugin/types/` は生成物なので、リポジトリには入れません。

## ライセンス

[MIT](LICENSE)
