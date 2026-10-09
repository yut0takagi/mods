# Security Policy

English | [日本語](#日本語)

## Supported versions

Only the latest version of each mod on the `main` branch receives fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately from the repository's **Security** tab with **Report a vulnerability**. Include the mod, the Claude Code version (`claude --version`) and the steps to reproduce.

Examples of what counts as a security problem here:

- A way for Claude to approve its own command in push-gate, or to accept a new baseline in branch-watch, without a person typing the command
- A command that a mod rewrites into something with a different effect (for example auto-worktree's `\git` rewrite changing what runs)
- A mod writing or sending data somewhere the documentation does not mention

You should get a first reply within a week. This is a personal project, so fixes may take longer.

---

## 日本語

### 対象の版

修正するのは、`main` ブランチにある各 mod の最新版だけです。

### 脆弱性の知らせ方

セキュリティにかかわる問題は、公開の Issue にしないでください。リポジトリの **Security** タブの **Report a vulnerability** から非公開で知らせてください。mod の名前、Claude Code の版（`claude --version`）、再現の手順を添えてください。

ここでセキュリティの問題として扱うものの例です。

- 人がコマンドを打たずに、Claude が push-gate の承認や branch-watch の基準の付け替えをできてしまう
- mod が書き換えたコマンドが、元と違う動きをする（auto-worktree の `\git` への書き換えで、実行される中身が変わる、など）
- ドキュメントに書いていない場所へ、mod がデータを書いたり送ったりしている

最初の返事は 1 週間以内を目安にします。個人のプロジェクトなので、修正にはそれより時間がかかることがあります。
