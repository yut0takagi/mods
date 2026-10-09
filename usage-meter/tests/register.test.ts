import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderInput } from 'claude-code'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/w' } as const

const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'usage-meter',
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: { title: 'トークン', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 44 }, view: {} },
}

function worldOf(on: On) {
  const world = { statuses: [] as (string | undefined)[], opened: [] as string[], surfaces: ['terminal'] as string[] }

  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // 画面がないセッションでも isPlaced: true が返る（実際には描かれない）
  on('ui.open', ($, e) => {
    world.opened.push(e.id)

    return { value: { isPlaced: true } } as never
  })
  on('ui.status', ($, e) => {
    world.statuses.push(e.text)

    return { value: undefined }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return world
}

const usage = (cacheRead: number) => ({ input_tokens: 1_000, output_tokens: 500, cache_read_input_tokens: cacheRead, cache_creation_input_tokens: 0, model: 'claude' })
const turn = (more: object) => ({ answer: '', reason: 'answer', durationMs: 1, isAborted: false, turnId: 't', ...more }) as never

test('ターンごとにステータス行を新しくし、サブエージェントは数えない', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.turn.complete(turn({ usage: usage(9_000) }))
  await $.turn.complete(turn({ usage: usage(0), agentId: 'a1' }))

  expect(world.statuses.at(-1)).toBe('入力 10.0k / 出力 500 · キャッシュ 90% · 計 10.5k')
})

test('ターミナルでは棒グラフ、ほかの画面では文字の棒で描く', async ($, on) => {
  worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.turn.complete(turn({ usage: usage(9_000) }))
  await $.turn.complete(turn({ usage: usage(20_000) }))
  await $.command.run({ command: 'usage-meter', args: '' } as never)

  const terminal = await $.ui.mount({ plugin: 'usage-meter', ...PANE } as never)
  expect(await terminal.find({ key: 'chart' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /2 ターン/ })).toBeDefined()
  await terminal.unmount()

  for (const surface of ['desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'usage-meter', ...PANE, surface } as never)
    expect(await ui.find({ type: 'Text', text: /▁|█/ })).toBeDefined()
    await ui.unmount()
  }
})

test('画面があれば、コマンドはペインを開くだけで返答の文は返さない', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.turn.complete(turn({ usage: usage(9_000) }))
  const ran = await $.command.run({ command: 'usage-meter', args: '' } as never)

  expect(world.opened).toEqual(['usage-meter'])
  expect(ran.text).toBeUndefined()
})

test('画面がなければ、ペインを開かずに直近のターンと推移を返答の文で返す', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  await $.turn.complete(turn({ usage: usage(9_000) }))
  await $.turn.complete(turn({ usage: usage(20_000) }))
  const ran = await $.command.run({ command: 'usage-meter', args: '' } as never)

  expect(world.opened).toEqual([])
  expect(ran.text).toBe(
    [
      '直近のターン: 入力 21.0k / 出力 500 · キャッシュ 95% · 計 32.0k',
      '推移（直近 2 ターン、入力と出力の合計）: ▄█',
      '2 ターン · 入力 31.0k · 出力 1.0k · キャッシュから読んだ入力 94%',
    ].join('\n'),
  )
})

test('画面がなく、ターンの記録もまだなければ、そう返す', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  const ran = await $.command.run({ command: 'usage-meter', args: '' } as never)

  expect(world.opened).toEqual([])
  expect(ran.text).toBe('まだターンの記録がありません。ターンが終わってから /usage-meter を打つと、トークン数の推移が出ます。')
})
