import { expect, mock, test } from 'claude-code/testing'
import type { ModelForkResult, On, RenderInput } from 'claude-code'

import { outcomeOf } from '../hooks/fork'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/w' } as const

const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'side-question',
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: { title: 'BTW', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 44 }, view: {} },
}

const USAGE = { input_tokens: 10, output_tokens: 50, cache_read_input_tokens: 90, cache_creation_input_tokens: 0 }

/** `surfaces` を空にすると、VS Code・Cursor の拡張機能のような画面のないセッションになる。 */
function worldOf(on: On, reply: ModelForkResult) {
  const world = { prompts: [] as string[], opened: [] as { id: string; focus: boolean }[], surfaces: ['terminal'] as string[] }

  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // 画面がないセッションでも isPlaced: true が返る（実際には描かれない）
  on('ui.open', ($, e) => {
    world.opened.push({ id: e.id, focus: e.focus === true })

    return { value: { isPlaced: true } } as never
  })
  on('model.fork', ($, e) => {
    world.prompts.push(e.prompt)

    return { value: reply } as never
  })

  return world
}

const run = (args: string) => ({ command: 'btw', args, origin: { kind: 'composer' } }) as never

test('/btw <質問> で会話の続きに聞き、答えをペインに出す。会話には何も返さない', async ($, on) => {
  const world = worldOf(on, { isAnswered: true, text: '**理由**は 2 つあります。', usage: USAGE })
  mock.clock(on)
  await $.session.start(SESSION)

  const done = await $.command.run(run('なんでこの設計？'))

  expect(done.text).toBeUndefined()
  expect(world.opened).toEqual([{ id: 'side-question', focus: false }])
  expect(world.prompts[0]).toContain('なんでこの設計？')

  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({ plugin: 'side-question', ...PANE, surface } as never)
    expect(await ui.find({ type: 'Text', text: /なんでこの設計？/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /キャッシュから読んだ入力 90%/ })).toBeDefined()
    await ui.unmount()
  }
})

test('/btw だけならペインを開いて入力欄から聞ける', async ($, on) => {
  const world = worldOf(on, { isAnswered: true, text: 'はい。', usage: USAGE })
  mock.clock(on)
  await $.session.start(SESSION)
  await $.command.run(run(''))

  expect(world.opened).toEqual([{ id: 'side-question', focus: true }])

  const ui = await $.ui.mount({ plugin: 'side-question', ...PANE, surface: 'terminal' })
  await ui.input({ key: 'ask', text: 'テストは足りてる？' })

  expect(world.prompts).toHaveLength(1)
  expect(await ui.find({ type: 'Text', text: /テストは足りてる？/ })).toBeDefined()
  await ui.unmount()
})

test('画面がなければ、ペインを開かずに答えを待ち、返答の文で返す。この文は会話に残る', async ($, on) => {
  const world = worldOf(on, { isAnswered: true, text: '**理由**は 2 つあります。', usage: USAGE })
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)

  const done = await $.command.run(run('  なんでこの設計？ '))

  expect(world.opened).toEqual([])
  expect(world.prompts[0]).toContain('なんでこの設計？')
  expect(done.text).toBe(
    [
      'Q. なんでこの設計？',
      '',
      '**理由**は 2 つあります。',
      '',
      'キャッシュから読んだ入力 90%',
      '',
      '（画面のないセッションなのでペインの代わりにここへ出しました。この答えは会話に残ります）',
    ].join('\n'),
  )
})

test('画面がなく、答えられなかったときは理由を返答の文で返す', async ($, on) => {
  const world = worldOf(on, { isAnswered: false, reason: 'nothing-to-fork' })
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)

  const done = await $.command.run(run('テストは足りてる？'))

  expect(world.opened).toEqual([])
  expect(done.text).toContain('Q. テストは足りてる？')
  expect(done.text).toContain('まだ会話がありません')
  expect(done.text).not.toContain('キャッシュから読んだ入力')
})

test('画面がなく、質問もなければ、聞かずに書き方を返す', async ($, on) => {
  const world = worldOf(on, { isAnswered: true, text: 'はい。', usage: USAGE })
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)

  const done = await $.command.run(run(''))

  expect(world.opened).toEqual([])
  expect(world.prompts).toEqual([])
  expect(done.text).toBe('質問は /btw のあとに続けて書いてください。例: /btw なんでこの設計？')
})

test('答えられなかったときは理由を出す', () => {
  expect(outcomeOf({ isAnswered: false, reason: 'nothing-to-fork' }).error).toContain('まだ会話がありません')
  expect(outcomeOf({ isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: USAGE } as never).error).toContain('529')
})
