import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import { cellsOf, COLORS, KEEP, replyOf, sparkline, statusOf, summaryOf, turnOf } from './chart'

const PANE = 'usage-meter'
const turns = atom({ plugin: 'usage-meter', key: 'turns' } as const, [])

// グラフの高さ（行）
const ROWS = 8

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 画面がない（VS Code の拡張機能など）と、推移は返答に出す。説明もそれに合わせる
    const isShown = (await $.session.surfaces().catch(() => undefined))?.length !== 0
    await $.command.register({
      name: 'usage-meter',
      description: isShown ? 'このセッションのトークン数の推移をペインに出す' : 'このセッションのトークン数の推移を返答に出す',
    })
    $.ui.status(statusOf(await read($, turns)))

    return next(e)
  })

  on('command.run', { command: 'usage-meter' }, async $ => {
    // 画面がないセッション（VS Code・Cursor の拡張機能、-p）では、ステータス行もペインも描かれない
    // （ui.open は isPlaced: true を返すので、それでは見分けられない）。中身を返答の文で返す。この文はモデルも読む
    if ((await $.session.surfaces()).length === 0) {
      return { text: replyOf(await read($, turns)) }
    }

    await $.ui.open({ id: PANE, title: 'トークン' })

    // 会話に何も足さないよう、出力の文は返さない
    return {}
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    // サブエージェントのターンは数えない
    if (e.agentId === undefined && e.usage !== undefined) {
      const turn = turnOf(e.usage)
      await update($, turns, list => [...list, turn].slice(-KEEP))
      $.ui.status(statusOf(await read($, turns)))
    }

    return done
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const list = await read($, turns)
    const width = Math.max(1, Math.min(list.length, e.props.bodyColumns))
    const [totals = '', cache = ''] = summaryOf(list)

    if (e.surface === 'terminal') {
      const { Box, Raster, Text } = $.ui.resolve(e)

      return (
        <Box flexDirection="column">
          {list.length === 0 ? (
            <Text dimColor>ターンが終わると、ここにトークン数の推移が出ます。</Text>
          ) : (
            <Raster key="chart" columns={width} rows={ROWS} cells={cellsOf(list, width, ROWS)} />
          )}
          <Box gap={1}>
            <Text color={`#${COLORS.cached.toString(16)}`}>■ キャッシュから読んだ入力</Text>
            <Text color={`#${COLORS.fresh.toString(16)}`}>■ それ以外の入力と出力</Text>
          </Box>
          <Text>{totals}</Text>
          <Text dimColor>{cache}</Text>
        </Box>
      )
    }

    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        {list.length === 0 ? (
          <Text dimColor>ターンが終わると、ここにトークン数の推移が出ます。</Text>
        ) : (
          <Text>{sparkline(list, width)}</Text>
        )}
        <Text>{totals}</Text>
        <Text dimColor>{cache}</Text>
      </Box>
    )
  })
}
