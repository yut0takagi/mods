/** 止めて、承認を待っているコマンド。 */
export type Pending = {
  /** 実行されかけたコマンド（前後の空白を除いたもの）。 */
  command: string
  /** どの設定項目に当たったか（`git push` など）。 */
  entry: string
}

/** 人が承認したコマンド。同じコマンドが 1 回通るまで、または期限まで有効。 */
export type Approval = {
  command: string
  /** 承認した時刻（エポックからのミリ秒）。 */
  at: number
}

declare module 'claude-code' {
  interface PluginState {
    'push-gate': { pending: Pending | null; approved: Approval | null }
  }
}
