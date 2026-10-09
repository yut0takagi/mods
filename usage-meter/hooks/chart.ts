/** 数の書き方と、グラフのマスの組み立て。$ に触れない部分。 */

import type { TurnUsage } from 'claude-code'

import type { Turn } from '../types'

/** 覚えておくターンの数。古いものから外す。 */
export const KEEP = 200

export const turnOf = (usage: TurnUsage): Turn => ({
  input: usage.input_tokens + usage.cache_read_input_tokens + usage.cache_creation_input_tokens,
  output: usage.output_tokens,
  cacheRead: usage.cache_read_input_tokens,
  model: usage.model,
})

/** 1234 → 1.2k、1250000 → 1.25M。 */
export function compact(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(2)}M`
  }

  return n >= 1_000 ? `${(n / 1_000).toFixed(1)}k` : String(n)
}

const rateOf = (turns: readonly Turn[]) => {
  const input = turns.reduce((sum, turn) => sum + turn.input, 0)

  return input === 0 ? 0 : turns.reduce((sum, turn) => sum + turn.cacheRead, 0) / input
}

export const percent = (rate: number) => `${Math.round(rate * 100)}%`

/** ステータス行。直近のターンと、セッションの合計。 */
export function statusOf(turns: readonly Turn[]): string | undefined {
  const last = turns.at(-1)

  if (last === undefined) {
    return undefined
  }

  const total = turns.reduce((sum, turn) => sum + turn.input + turn.output, 0)

  return `入力 ${compact(last.input)} / 出力 ${compact(last.output)} · キャッシュ ${percent(rateOf([last]))} · 計 ${compact(total)}`
}

export function summaryOf(turns: readonly Turn[]): string[] {
  const input = turns.reduce((sum, turn) => sum + turn.input, 0)
  const output = turns.reduce((sum, turn) => sum + turn.output, 0)

  return [
    `${turns.length} ターン · 入力 ${compact(input)} · 出力 ${compact(output)}`,
    `キャッシュから読んだ入力 ${percent(rateOf(turns))}`,
  ]
}

const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

/** ターンごとの合計を 1 文字ずつの棒にした行。Raster のない画面で使う。 */
export function sparkline(turns: readonly Turn[], width: number): string {
  const shown = turns.slice(-width)
  const max = Math.max(1, ...shown.map(turn => turn.input + turn.output))

  return shown.map(turn => BLOCKS[Math.min(7, Math.floor(((turn.input + turn.output) / max) * 7.999))]).join('')
}

/** 返答の文で棒を並べるターンの数。会話欄の幅は分からないので、狭くても折り返しにくい数に抑える。 */
export const REPLY_TURNS = 40

/**
 * 画面がないセッションで、ステータス行とペインの代わりにコマンドの返答として出す文。
 * 直近のターンの要約（ステータス行と同じ）、推移の棒、セッションの合計の順に並べる。
 */
export function replyOf(turns: readonly Turn[]): string {
  const status = statusOf(turns)

  if (status === undefined) {
    return 'まだターンの記録がありません。ターンが終わってから /usage-meter を打つと、トークン数の推移が出ます。'
  }

  const width = Math.min(turns.length, REPLY_TURNS)
  const [totals = '', cache = ''] = summaryOf(turns)

  return [
    `直近のターン: ${status}`,
    `推移（直近 ${width} ターン、入力と出力の合計）: ${sparkline(turns, width)}`,
    `${totals} · ${cache}`,
  ].join('\n')
}

const FULL = 0x2588
// ▁ から ▇ まで。高さ 1/8〜7/8 のマス
const PARTIAL = [0x2581, 0x2582, 0x2583, 0x2584, 0x2585, 0x2586, 0x2587]
const DEFAULT = 0x01000000

/** キャッシュから読んだ分と、それ以外の色。 */
export const COLORS = { cached: 0x5f87af, fresh: 0xff8700 }

/**
 * ターンごとの棒グラフのマス。下からキャッシュから読んだ分、その上にそれ以外（キャッシュしていない入力と出力）を積む。
 * 戻り値は Raster の cells にそのまま渡せる base64。
 */
export function cellsOf(turns: readonly Turn[], columns: number, rows: number): string {
  const shown = turns.slice(-columns)
  const max = Math.max(1, ...shown.map(turn => turn.input + turn.output))
  const words = new Uint32Array(columns * rows * 3)

  // 空白で埋める
  for (let i = 0; i < columns * rows; i += 1) {
    words.set([0x20, DEFAULT, DEFAULT], i * 3)
  }

  shown.forEach((turn, column) => {
    // 高さは 1/8 マス単位
    const eighths = Math.round(((turn.input + turn.output) / max) * rows * 8)
    const cachedEighths = Math.round((turn.cacheRead / max) * rows * 8)

    for (let row = 0; row < rows; row += 1) {
      const bottom = row * 8
      const filled = Math.min(8, Math.max(0, eighths - bottom))

      if (filled === 0) {
        continue
      }

      const color = bottom + filled <= cachedEighths ? COLORS.cached : COLORS.fresh
      const glyph = filled === 8 ? FULL : (PARTIAL[filled - 1] ?? FULL)
      words.set([glyph, color, DEFAULT], ((rows - 1 - row) * columns + column) * 3)
    }
  })

  return base64Of(new Uint8Array(words.buffer))
}

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function base64Of(bytes: Uint8Array): string {
  let out = ''

  for (let i = 0; i < bytes.length; i += 3) {
    const [a = 0, b = 0, c = 0] = [bytes[i], bytes[i + 1], bytes[i + 2]]
    const n = (a << 16) | (b << 8) | c
    out += ALPHABET[(n >> 18) & 63]! + ALPHABET[(n >> 12) & 63]!
    out += i + 1 < bytes.length ? ALPHABET[(n >> 6) & 63]! : '='
    out += i + 2 < bytes.length ? ALPHABET[n & 63]! : '='
  }

  return out
}
