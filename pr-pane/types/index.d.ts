/** CI の結果をまとめたもの。`none` は CI が走っていない PR。 */
export type Check = 'pass' | 'fail' | 'pending' | 'none'

export type Pr = {
  number: number
  title: string
  head: string
  base: string
  author: string
  isDraft: boolean
  /** gh の reviewDecision（APPROVED / CHANGES_REQUESTED / REVIEW_REQUIRED / 空）。 */
  review: string
  url: string
  check: Check
}

/**
 * gh が失敗したわけ。画面がないときの /prs の返答で、次に何をすればよいかを添えるのに使う。
 * `no-gh` は gh を起動できなかったとき、`timeout` は時間内に終わらなかったとき。
 */
export type Cause = 'no-gh' | 'timeout' | 'no-auth' | 'no-repo' | 'other'

export type Board = {
  prs: Pr[]
  /** 取った時刻（エポックからのミリ秒）。 */
  fetchedAt: number
  /** gh が失敗したときの理由。 */
  error?: string
  /** gh が失敗したときの、理由の分類。 */
  cause?: Cause
}

declare module 'claude-code' {
  interface PluginState {
    'pr-pane': { board: Board | null }
  }
}
