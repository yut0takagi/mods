import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderInput } from 'claude-code'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/w' } as const

const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'session-diff',
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: { title: '変更', isFocused: false, bodyColumns: 80, placement: 'dock', scroll: { offset: 0, bodyRows: 44 }, view: {} },
}

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

const PATCH = 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,2 +1,2 @@\n const a = 1\n-const b = 2\n+const b = 3\n'

/**
 * git と画面を手元で真似る。`/w/src/a.ts` は追跡済み、`/w/new.ts` は追跡していない。
 * `surfaces` を空にすると、VS Code・Cursor の拡張機能のような画面のないセッションになる。
 * `isUnborn` にすると、まだコミットのないリポジトリになる（`/w/src/a.ts` は add 済み）。
 */
function worldOf(on: On, toolAnswer: object = { result: { filePath: '', oldString: '', newString: '' } }) {
  const world = { argv: [] as string[][], surfaces: ['terminal'] as string[], opened: 0, toasts: [] as string[], isUnborn: false }

  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  // 画面がなくても isPlaced は true が返る
  on('ui.open', () => {
    world.opened++

    return { value: { isPlaced: true } } as never
  })
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('process.run', ($, e) => {
    world.argv.push([...e.argv])

    const out = (exitCode: number, stdout: string) => ({
      value: { exitCode, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    const [, sub] = e.argv
    const path = e.argv.at(-1)

    if (sub === 'ls-files') {
      return out(path === '/w/src/a.ts' ? 0 : 1, '')
    }

    if (sub === 'hash-object') {
      return out(0, `${EMPTY_TREE}\n`)
    }

    // 本物の git と同じく、コミットがなければ HEAD と比べられない
    if (world.isUnborn && e.argv.includes('HEAD')) {
      return out(128, '')
    }

    if (e.argv.includes('--numstat')) {
      return out(0, path === '/w/src/a.ts' ? '1\t1\tsrc/a.ts\n' : '2\t0\tnew.ts\n')
    }

    return out(0, PATCH)
  })
  on('tool.call', () => toolAnswer as never)

  return world
}

const edit = (file_path: string) => ({ tool: 'Edit' as const, file_path, old_string: 'a', new_string: 'b' })
const write = (file_path: string) => ({ tool: 'Write' as const, file_path, content: 'x' })

/** 人が入力欄から打った `/session-diff <args>`。 */
const typed = (args: string) => ({ command: 'session-diff', args, origin: { kind: 'composer' } }) as never

test('編集したファイルと増減を並べ、選ぶと差分を出す', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(edit('/w/src/a.ts'))
  await $.tool.call(write('/w/new.ts'))
  await $.tool.call(edit('/w/src/a.ts'))
  await $.command.run({ command: 'session-diff', args: '' } as never)

  expect(world.argv).toContainEqual(['git', 'diff', '--no-index', '--numstat', '--', '/dev/null', '/w/new.ts'])

  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ plugin: 'session-diff', ...PANE, surface } as never)
    expect(await ui.find({ key: 'file-0' })).toBeDefined()
    expect(await ui.find({ key: 'file-1' })).toBeDefined()
    expect(await ui.find({ key: 'file-2' })).toBeUndefined()

    await ui.press({ key: 'file-0' })
    expect(await ui.find({ type: 'Code' })).toBeDefined()
    await ui.unmount()
  }
})

test('拒否されたり失敗したりした編集は数えない', async ($, on) => {
  worldOf(on, { deny: 'no' })
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(edit('/w/src/a.ts'))

  const ui = await $.ui.mount({ plugin: 'session-diff', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /まだ何も編集していません/ })).toBeDefined()
  await ui.unmount()
})

test('画面があるときは文を返さず、パスを渡すとペインでその差分を開く', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(edit('/w/src/a.ts'))

  const answer = await $.command.run(typed('src/a.ts'))
  expect(answer.text).toBeUndefined()
  expect(world.opened).toBe(1)

  const ui = await $.ui.mount({ plugin: 'session-diff', ...PANE } as never)
  expect(await ui.find({ type: 'Code' })).toBeDefined()
  await ui.unmount()

  await $.command.run(typed('nope.ts'))
  expect(world.toasts).toEqual(['このセッションで編集したファイルに nope.ts はありません'])
})

test('画面がないときは、編集したファイルと増減を返答の文で出す', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)

  const before = await $.command.run(typed(''))
  await $.tool.call(edit('/w/src/a.ts'))
  await $.tool.call(write('/w/new.ts'))
  const after = await $.command.run(typed(''))

  expect(before.text).toBe('このセッションではまだ何も編集していません。')
  expect(after.text).toBe(
    [
      'このセッションで編集したファイル（まだ commit していない変更）: 2 件',
      '',
      '- +1 −1  `src/a.ts`',
      '- +2 −0  `new.ts`',
      '',
      '差分は `/session-diff <パス>` で出します。',
    ].join('\n'),
  )
  // 描かれないペインは開かない
  expect(world.opened).toBe(0)
})

test('画面がないときは、/session-diff <パス> でそのファイルの差分を返答の文で出す', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(edit('/w/src/a.ts'))
  await $.tool.call(write('/w/new.ts'))

  // 一覧に出る相対パス、絶対パス、ファイル名だけのどれでも引ける
  for (const args of ['src/a.ts', '/w/src/a.ts', ' a.ts ']) {
    const answer = await $.command.run(typed(args))
    expect(answer.text).toBe(
      [
        '`src/a.ts` の差分（まだ commit していない変更 +1 −1）',
        '',
        '```diff',
        '@@ -1,2 +1,2 @@',
        ' const a = 1',
        '-const b = 2',
        '+const b = 3',
        '```',
      ].join('\n'),
    )
  }

  expect(world.opened).toBe(0)
})

test('コミットのないリポジトリでは、add 済みのファイルを空の tree と比べる', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  world.isUnborn = true
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(edit('/w/src/a.ts'))

  const answer = await $.command.run(typed('src/a.ts'))

  expect(world.argv).toContainEqual(['git', 'diff', EMPTY_TREE, '--', '/w/src/a.ts'])
  expect(answer.text).toContain('`src/a.ts` の差分（まだ commit していない変更 +1 −1）')
  expect(answer.text).toContain('+const b = 3')
})

test('画面がないとき、編集していないパスにはそう返して一覧を添え、中身は読まない', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(edit('/w/src/a.ts'))

  const answer = await $.command.run(typed('README.md'))

  expect(answer.text).toContain('このセッションで編集したファイルに `README.md` はありません。')
  expect(answer.text).toContain('- +1 −1  `src/a.ts`')
  expect(world.argv.some(argv => argv.at(-1) === '/w/README.md')).toBe(false)
})
