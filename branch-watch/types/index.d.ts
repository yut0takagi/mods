/** worktree のルート（`git rev-parse --show-toplevel`）から、そのセッションの基準ブランチへ。 */
export type Baselines = Record<string, string>

/** 共有のディレクトリに書く、1 セッションぶんの様子。ほかのセッションはこれを読んで一覧にする。 */
export type Peer = {
  /** session id。ファイル名にもなる。 */
  id: string
  /** 最初のプロンプトの書き出し。人がどのセッションかを見分けるためのもの。まだなければ空。 */
  label: string
  /** 作業している場所。git の外ならそのディレクトリ。 */
  dir: string
  /** 作業している worktree のルート。git の外なら無い。 */
  root?: string
  branch?: string
  /** その worktree でのこのセッションの基準ブランチ。 */
  baseline?: string
  /** ターンの途中か。 */
  isWorking: boolean
  /** 最後に書いた時刻（エポックからのミリ秒）。 */
  updatedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    'branch-watch': {
      baselines: Baselines
      /** 最後にトーストで知らせた `<root>@<branch>`。同じ切り替えを何度も知らせない。 */
      warned: string
      /**
       * 画面がないセッションで、最後にモデルへ伝えた `<root>@<branch>`。
       * トーストの代わりにプロンプトかツールの結果へ添えるので、同じずれを何度も添えない。
       */
      noted: string
      /** 最後にファイルを編集したか、コマンドを実行した worktree のルート。まだなら空で、セッションの cwd を使う。 */
      here: string
      /** そのセッションの名札。`id` が変わったら（/clear）取り直す。 */
      label: { id: string; text: string }
      isWorking: boolean
      /** 自分を含む、動いているセッションの一覧。自分が先頭。ペインが読む。 */
      peers: Peer[]
    }
  }
}
