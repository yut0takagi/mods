import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { dirOf, KEEP, listText, parseNumstat, patchOf, patchText, pickOf, shortOf, statText } from './diff'

const PANE = 'session-diff'
const files = atom({ plugin: 'session-diff', key: 'files' } as const, [])
const stats = atom({ plugin: 'session-diff', key: 'stats' } as const, {})
const patch = atom({ plugin: 'session-diff', key: 'patch' } as const, null)

/** 1 ファイルの、HEAD からのまだ commit していない差分。追跡していないファイルは空のファイルとの差分にする。 */
async function gitDiff($: EngineInterface, path: string, options: readonly string[]): Promise<string> {
  const cwd = dirOf(path)
  const git = (args: readonly string[], timeoutMs = 10_000) =>
    $.process.run(['git', ...args], { cwd, timeoutMs }).catch(() => undefined)
  const tracked = await git(['ls-files', '--error-unmatch', '--', path], 5_000)

  if (tracked?.exitCode !== 0) {
    // --no-index は差分があると 1 で終わるので、終了コードは見ない
    return (await git(['diff', '--no-index', ...options, '--', '/dev/null', path]))?.stdout ?? ''
  }

  const ran = await git(['diff', ...options, 'HEAD', '--', path])

  if (ran?.exitCode === 0) {
    return ran.stdout
  }

  // コミットのないリポジトリには HEAD がない。add 済みのファイルは空の tree と比べる（-w がないので何も書かない）
  const empty = await git(['hash-object', '-t', 'tree', '/dev/null'], 5_000)

  return empty?.exitCode === 0 ? ((await git(['diff', ...options, empty.stdout.trim(), '--', path]))?.stdout ?? '') : ''
}

async function refreshStat($: EngineInterface, path: string) {
  const stat = parseNumstat(await gitDiff($, path, ['--numstat']))
  await update($, stats, all => ({ ...all, [path]: stat }))
}

async function refreshAll($: EngineInterface) {
  for (const path of await read($, files)) {
    await refreshStat($, path)
  }
}

async function openPatch($: EngineInterface, path: string) {
  const next = patchOf(path, await gitDiff($, path, []))
  await update($, patch, () => next)
}

/** 画面のないセッションで返す文。パスが引き当たればそのファイルの差分、でなければ一覧。 */
async function answerOf($: EngineInterface, cwd: string, want: string, path: string | null) {
  if (path !== null) {
    const stdout = await gitDiff($, path, [])
    await refreshStat($, path)

    return patchText(path, stdout, (await read($, stats))[path] ?? null, cwd)
  }

  await refreshAll($)

  return listText(await read($, files), await read($, stats), cwd, want === '' ? undefined : want)
}

export const register: Register = on => {
  let cwd = ''

  on('session.start', async ($, e, next) => {
    cwd = e.cwd
    await $.command.register({
      name: 'session-diff',
      description: 'このセッションで編集したファイルと差分を出す',
      argumentHint: '[パス]',
    })

    return next(e)
  })

  on('command.run', { command: 'session-diff' }, async ($, e) => {
    const want = e.args.trim()
    const path = want === '' ? null : pickOf(await read($, files), want, cwd)

    // VS Code・Cursor の拡張機能のセッションには画面がなく、ペインは開いても描かれない
    // （ui.open は isPlaced を返すので当てにならない）。中身を返答の文で見せる
    if ((await $.session.surfaces()).length === 0) {
      return { text: await answerOf($, cwd, want, path) }
    }

    await $.ui.open({ id: PANE, title: '変更' })
    await refreshAll($)

    // パスを渡されたら、そのファイルの差分も開いておく
    if (path !== null) {
      await openPatch($, path)
    } else if (want !== '') {
      $.ui.toast(`このセッションで編集したファイルに ${want} はありません`)
    }

    // 会話に何も足さないよう、出力の文は返さない
    return {}
  })

  on('tool.call', async ($, e, next) => {
    const path = e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : e.tool === 'NotebookEdit' ? e.notebook_path : undefined
    const ran = await next(e)

    if (path === undefined || ran.deny !== undefined || ran.isError === true) {
      return ran
    }

    await update($, files, list => [...list.filter(one => one !== path), path].slice(-KEEP))
    await refreshStat($, path)

    // 開いている差分のファイルを編集したら、差分も新しくする
    if ((await read($, patch))?.path === path) {
      await openPatch($, path)
    }

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Code, Text } = $.ui.resolve(e)
    const list = await read($, files)
    const all = await read($, stats)
    const open = await read($, patch)

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text dimColor>このセッションで編集したファイル（まだ commit していない変更）</Text>
          <Button key="refresh" label="更新" onPress={() => refreshAll($)} />
        </Box>
        {list.length === 0 && <Text dimColor>まだ何も編集していません。</Text>}
        {list.map((path, i) => (
          <Button
            key={`file-${i}`}
            plain
            label={`${path in all ? statText(all[path] ?? null) : '…'}  ${shortOf(path, cwd)}`}
            onPress={() => openPatch($, path)}
          />
        ))}
        {open !== null && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{shortOf(open.path, cwd)}</Text>
            {open.text === '' ? (
              <Text dimColor>まだ commit していない変更はありません。</Text>
            ) : (
              <Code source={open.text} format="diff" path={open.path} />
            )}
            {open.isCut && <Text dimColor>長いので先頭だけ出しています。</Text>}
          </Box>
        )}
      </Box>
    )
  })
}
