/** 脇道の質問 1 つと、その答え。答えも理由もないあいだは考え中。 */
export type Entry = {
  id: number
  question: string
  answer?: string
  /** 答えられなかった理由。 */
  error?: string
  /** プロンプトキャッシュから読んだ入力の割合（0〜1）。 */
  cacheRate?: number
}

declare module 'claude-code' {
  interface PluginState {
    'side-question': { entries: Entry[] }
  }
}
