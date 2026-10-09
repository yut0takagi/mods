import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Check } from '../types'
import { causeOf, clockOf, detailOf, FIELDS, firstLine, MARK, parsePrs, summaryOf, textOf } from './prs'

const PANE = 'pr-pane'
const board = atom({ plugin: 'pr-pane', key: 'board' } as const, null)

const COLOR: Record<Check, string | undefined> = { pass: 'green', fail: 'red', pending: 'yellow', none: undefined }

const TIMEOUT_MS = 20_000

/** gh pr list を呼び直して、ペインとステータス行を新しくする。 */
async function refresh($: EngineInterface, base: string) {
  const argv = ['gh', 'pr', 'list', '--state', 'open', '--limit', '30', '--json', FIELDS]

  if (base !== '') {
    argv.push('--base', base)
  }

  const startedAt = await $.clock.now()
  const ran = await $.process
    .run(argv, { timeoutMs: TIMEOUT_MS })
    .catch((error: unknown) => ({ exitCode: 1, stdout: '', stderr: String(error), isRejected: true as const }))
  const fetchedAt = await $.clock.now()

  if (ran.exitCode !== 0) {
    // 起動できなかったときと時間切れのときは reject される。どちらかは、かかった時間で見分ける
    const cause = 'isRejected' in ran ? (fetchedAt - startedAt >= TIMEOUT_MS / 2 ? 'timeout' : 'no-gh') : causeOf(ran.stderr)
    await update($, board, () => ({ prs: [], fetchedAt, error: firstLine(ran.stderr) || 'gh pr list が失敗しました', cause }))
    $.ui.status(undefined)

    return
  }

  const prs = parsePrs(ran.stdout)
  await update($, board, () => ({ prs, fetchedAt }))
  $.ui.status(summaryOf(prs))
}

/** 描く画面があるか。読めないときは、あるとみなして今までどおりに動く。 */
const hasScreen = async ($: EngineInterface) => (await $.session.surfaces().catch(() => undefined))?.length !== 0

export const register: Register = (on, options) => {
  const base = typeof options.base === 'string' ? options.base.trim() : ''
  const intervalMs = Math.max(30, Number(options.intervalSeconds) || 120) * 1_000
  const title = base === '' ? 'PR' : `PR → ${base}`

  on('session.start', async ($, e, next) => {
    const screen = await hasScreen($)
    await $.command.register({
      name: 'prs',
      description: screen ? 'PR と CI の状態をペインに出して、取り直す' : 'PR と CI の状態を取り直して、返答に出す',
    })

    // 画面がない（VS Code の拡張機能など）と、取っても描く先がない。そのあいだは /prs で頼まれたときだけ取る。
    // あとから画面がつながることもあるので、定期の取得は登録しておき、そのたびに画面の有無を見る
    if (screen) {
      void refresh($, base)
    }

    $.clock.every(intervalMs, () => void hasScreen($).then(isShown => (isShown ? refresh($, base) : undefined)))

    return next(e)
  })

  on('command.run', { command: 'prs' }, async $ => {
    // 画面がないセッション（VS Code の拡張機能など）では、ペインもステータス行も描かれない。
    // ui.open は isPlaced: true を返すのに描かれないので、isPlaced ではなく surfaces で見分け、取り直した中身を返答のテキストで返す
    if ((await $.session.surfaces()).length === 0) {
      await refresh($, base)

      return { text: textOf(await read($, board), base) }
    }

    const opened = await $.ui.open({ id: PANE, title })
    await refresh($, base)

    return { text: opened.isPlaced ? 'PR のペインを開きました。' : `PR のペインを開けませんでした: ${opened.reason}` }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Link, Text } = $.ui.resolve(e)
    const now = await read($, board)

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text dimColor>{now === null ? '取得中…' : `${clockOf(now.fetchedAt)} 時点`}</Text>
          <Button key="refresh" label="更新" onPress={() => refresh($, base)} />
        </Box>
        {now?.error !== undefined && <Text color="red">{now.error}</Text>}
        {now !== null && now.error === undefined && now.prs.length === 0 && (
          <Text dimColor>開いている PR はありません。</Text>
        )}
        {now?.prs.map(pr => (
          <Box key={`pr-${pr.number}`} flexDirection="column" marginTop={1}>
            <Box gap={1}>
              <Text color={COLOR[pr.check]} dimColor={pr.check === 'none'}>
                {MARK[pr.check]}
              </Text>
              <Link href={pr.url} label={`#${pr.number}`} />
              <Text wrap="truncate-end">{pr.title}</Text>
            </Box>
            <Text dimColor wrap="truncate-end">
              {detailOf(pr)}
            </Text>
          </Box>
        ))}
      </Box>
    )
  })
}
