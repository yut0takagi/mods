# CONTRIBUTING

[English](CONTRIBUTING.md) | 日本語

不具合の報告、修正、新しい mod の提案を歓迎します。このページは、mod のコードやドキュメントを直したい人に向けて書いています。使い方は [docs](docs/ja/README.md) を見てください。

## 始める前に

- 不具合の報告と要望は [Issues](https://github.com/yut0takagi/mods/issues) に書いてください。テンプレートがあります
- 新しい mod や、既存の mod の動きを変える提案は、PR の前に Issue で相談してください。誤字や小さな不具合の修正は、いきなり PR でかまいません
- セキュリティにかかわる問題は Issue にせず、[SECURITY](SECURITY.md#日本語) の手順で知らせてください
- やり取りは [行動規範](CODE_OF_CONDUCT.ja.md) に沿ってください

## 用意するもの

- Claude Code 2.1.289 以降
- git
- 型検査に TypeScript 5（`npx` で呼べれば十分です。`package.json` はありません）
- pr-pane を触るなら GitHub CLI（`gh`）

## リポジトリの構成

```text
mods/
├── .claude-plugin/marketplace.json   # マーケットプレイスの目録。mod を足したらここにも足す
├── <mod>/
│   ├── .claude-plugin/plugin.json    # マニフェスト（名前・版・説明・設定項目）
│   ├── hooks/hooks.json              # フックのモジュールを指す
│   ├── hooks/register.ts(x)          # フック本体。$ を使うのはここだけ
│   ├── hooks/<判断>.ts               # $ に触れない判断の処理（git.ts、judge.ts など）
│   ├── types/index.d.ts              # $.state に置く値の型（使う mod だけ）
│   ├── tests/                        # *.test.ts
│   └── tsconfig.json
├── docs/                             # 英語のドキュメント
└── docs/ja/                          # 日本語のドキュメント
```

`<mod>/.claude-plugin/types/` は、Claude Code が mod を読み込むときに置く型の生成物です。`.gitignore` で除いています。

## 動かして確かめる

```sh
git clone https://github.com/yut0takagi/mods
cd mods

claude --plugin-dir ./branch-watch      # このセッションだけ読み込む
claude plugin validate ./branch-watch   # マニフェストとフックを検証する
claude plugin test ./branch-watch       # tests/*.test.ts を実行する
claude plugin validate .                # マーケットプレイスの目録を検証する
```

型検査は、一度その mod を読み込んで `.claude-plugin/types/` ができてから行います。

```sh
npx --yes --package=typescript@5 -- tsc -p ./branch-watch
```

`claude plugin test` が `hooks modules are turned off in this process: the rollout switch was saved off …` で止まることがあります。mod の機能の配布スイッチが、以前のセッションで off のまま保存されているためです。ネットワークにつながった状態で `claude` を 1 回起動すると取り直されるので、そのあともう一度実行してください。同じ文言が続くときは、Claude Code 側で mod の機能が止められています。

## コードの書き方

既存の mod に合わせてください。とくに次の 5 点を守ってください。

- **判断は `$` から切り離す。** 「このコマンドは commit か」「このセッションはワークツリーに入るべきか」のような判断は、`$` に触れない関数として別ファイルに置き、単体でテストします。`register` はその関数とエンジンをつなぐだけにします
- **画面がなくても伝わるようにする。** VS Code・Cursor の拡張機能では、ステータス行・トースト・ペイン・ボタンが描かれません。人に見せる情報は、`$.session.surfaces()` が空のときにコマンドの返答か Claude への添え書きで伝えます（[拡張機能のページ](docs/ja/editors.md)）
- **人だけに許す操作は入力元を確かめる。** 承認や基準の付け替えのように Claude にさせたくない操作は、コマンドの `origin.kind` が `composer` か `bridge` のときだけ受け付けます
- **失敗してもプロンプトを止めない。** mod の中の `$.process.run` や `$.fs.read` が失敗しても、`catch` して元の処理（`next(e)`）に戻します。mod の不具合でユーザーの作業を止めないためです
- **コメントには理由を書く。** コードを読めば分かることではなく、なぜそうしたかを書きます。既存のコメントは日本語です

## テストの書き方

- 足した動きごとに、少なくとも 1 つテストを書きます。テストの名前は、その動きを日本語の 1 文で言い表します（例: `コミットのないリポジトリでも、git のリポジトリとして扱う`）
- エンジンの外側（git、ファイル、画面）は、テストの `on(...)` で真似ます。本物の git の動き（コミットがないと HEAD を解決できない、など）は、真似る側でも再現してください。真似が甘いと、本物でだけ壊れる不具合を見逃します
- 画面を描くテストは、`['terminal', 'desktop'] as const` のように複数の画面で回します
- 画面がない場合（`surfaces` が空）のテストも書きます

## 新しい mod を足すとき

次をすべて同じ PR に入れてください。

- [ ] `<mod>/` 一式（`plugin.json`、`hooks/`、`tests/`、`tsconfig.json`）
- [ ] `.claude-plugin/marketplace.json` への 1 項目
- [ ] `README.md` と `README.ja.md` の表への 1 行
- [ ] `docs/mods/<mod>.md` と `docs/ja/mods/<mod>.md`
- [ ] `docs/editors.md` と `docs/ja/editors.md` の表への 1 行（拡張機能での使い方）
- [ ] `CHANGELOG.md` への追記

## ドキュメント

英語（`docs/`）と日本語（`docs/ja/`）は同じ PR で直してください。片方の言語しか書けないときは、PR にそう書いてもらえれば、もう片方はメンテナが足します。

## 版と CHANGELOG

mod ごとに版を持ちます（[セマンティック バージョニング](https://semver.org/lang/ja/)）。動きを変えたら `plugin.json` と `marketplace.json` の `version` を同じ値に上げ、`CHANGELOG.md` に書きます。ドキュメントだけの変更では版を上げません。

## commit と PR

- commit メッセージは `種類(mod): 内容` の形にします。種類は `feat`・`fix`・`docs`・`test`・`refactor`・`chore` のどれかです。例: `fix(session-diff): コミットのないリポジトリで差分が空になるのを直す`
- PR を出す前に、触った mod の `claude plugin validate` と `claude plugin test`、型検査を通してください
- PR のテンプレートのチェック項目を埋めてください

PR を出すと、GitHub Actions が 9 本すべての mod で validate・テスト・型検査を回します。Claude Code は、確かめた版（2.1.294）と最新版の 2 通りで動かします。確かめた版で落ちたら PR を直してください。最新版だけで落ちたときは PR を止めません。Claude Code の更新で mod の API が変わった合図として扱い、別に直します。

## ライセンス

PR で送ったコードとドキュメントは、このリポジトリと同じ [MIT License](LICENSE) で公開されます。
