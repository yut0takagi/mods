/** まだ commit していない変更の行数。`null` は変更がない（commit 済みか、元に戻した）。 */
export type Stat = { added: number; removed: number } | null

/** ペインで開いている差分。 */
export type Patch = {
  path: string
  /** `@@` から始まる unified diff。 */
  text: string
  /** 長すぎて先頭だけにしたか。 */
  isCut: boolean
}

declare module 'claude-code' {
  interface PluginState {
    'session-diff': {
      /** このセッションが編集したファイルの絶対パス。編集した順。 */
      files: string[]
      stats: Record<string, Stat>
      patch: Patch | null
    }
  }
}
