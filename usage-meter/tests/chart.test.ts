import { describe, expect, test } from 'claude-code/testing'

import { base64Of, cellsOf, compact, REPLY_TURNS, replyOf, sparkline, statusOf, turnOf } from '../hooks/chart'

const turn = (input: number, output: number, cacheRead: number) => ({ input, output, cacheRead, model: 'm' })

describe('数の書き方', () => {
  test('k と M で縮める', () => {
    expect(compact(950)).toBe('950')
    expect(compact(1_234)).toBe('1.2k')
    expect(compact(1_250_000)).toBe('1.25M')
  })

  test('入力にはキャッシュの読み書きを含める', () => {
    expect(turnOf({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 80, cache_creation_input_tokens: 10, model: 'm' })).toEqual(
      turn(100, 5, 80),
    )
  })

  test('ステータス行は直近のターンと合計', () => {
    expect(statusOf([])).toBeUndefined()
    expect(statusOf([turn(1_000, 100, 0), turn(52_100, 1_300, 49_000)])).toBe('入力 52.1k / 出力 1.3k · キャッシュ 94% · 計 54.5k')
  })
})

describe('グラフ', () => {
  test('base64 は標準の書き方', () => {
    expect(base64Of(new TextEncoder().encode('Man'))).toBe('TWFu')
    expect(base64Of(new TextEncoder().encode('Ma'))).toBe('TWE=')
    expect(base64Of(new TextEncoder().encode('M'))).toBe('TQ==')
  })

  test('マスの数は列×行×3 語', () => {
    const cells = cellsOf([turn(100, 0, 50), turn(50, 0, 0)], 2, 4)
    // 2 列 × 4 行 × 3 語 × 4 バイト = 96 バイト → base64 で 128 文字
    expect(cells).toHaveLength(128)
  })

  test('Raster のない画面では 1 文字の棒を並べる', () => {
    expect(sparkline([turn(10, 0, 0), turn(80, 0, 0)], 10)).toBe('▁█')
    expect(sparkline([turn(10, 0, 0), turn(80, 0, 0)], 1)).toBe('█')
  })
})

describe('画面がないときの返答', () => {
  test('ターンの記録がまだなければ、そう返す', () => {
    expect(replyOf([])).toBe('まだターンの記録がありません。ターンが終わってから /usage-meter を打つと、トークン数の推移が出ます。')
  })

  test('直近のターン、推移の棒、セッションの合計を並べる', () => {
    expect(replyOf([turn(1_000, 100, 0), turn(52_100, 1_300, 49_000)])).toBe(
      [
        '直近のターン: 入力 52.1k / 出力 1.3k · キャッシュ 94% · 計 54.5k',
        '推移（直近 2 ターン、入力と出力の合計）: ▁█',
        '2 ターン · 入力 53.1k · 出力 1.4k · キャッシュから読んだ入力 92%',
      ].join('\n'),
    )
  })

  test('棒は直近の決まった数のターンだけ並べ、合計はすべてのターンで数える', () => {
    const lines = replyOf(Array.from({ length: REPLY_TURNS + 10 }, () => turn(100, 0, 0))).split('\n')

    expect(lines[1]).toBe(`推移（直近 ${REPLY_TURNS} ターン、入力と出力の合計）: ${'█'.repeat(REPLY_TURNS)}`)
    expect(lines[2]).toStartWith(`${REPLY_TURNS + 10} ターン`)
  })
})
