/** 1 ターンのトークン数。入力はキャッシュから読んだ分と書いた分を含む。 */
export type Turn = {
  input: number
  output: number
  cacheRead: number
  model: string
}

declare module 'claude-code' {
  interface PluginState {
    'usage-meter': { turns: Turn[] }
  }
}
