import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderInput } from 'claude-code'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/w' } as const

const BAND: RenderInput<'AbovePrompt'> = {
  component: 'AbovePrompt',
  surface: 'terminal',
  requestId: 'band',
  viewport: { columns: 120, rows: 40, isFullscreen: true },
  props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 100, scroll: { offset: 0, bodyRows: 9 }, view: {} },
}

function worldOf(on: On) {
  const world = { ran: [] as string[], submitted: [] as string[], toasts: [] as string[], surfaces: ['terminal'] as string[] }

  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  // 帯に何も出さないとき、Claude Code が描く代わり
  on('ui.render', () => ({ type: 'Text', children: [''] }) as never)
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    world.submitted.push(e.text)

    return { text: e.text }
  })
  on('tool.call', ($, e) => {
    if (e.tool === 'Bash') {
      world.ran.push(e.command)
    }

    return { result: { stdout: '', stderr: '', interrupted: false } } as never
  })

  return world
}

const bash = (command: string) => ({ tool: 'Bash' as const, command })
const typed = (args: string) => ({ command: 'push-gate', args, origin: { kind: 'composer' } }) as never

test('git push を止め、帯に承認ボタンを出す', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)

  const ran = await $.tool.call(bash('git push origin main'))

  expect(ran.deny).toContain('人の承認が要る')
  expect(world.ran).toEqual([])
  expect(world.toasts).toEqual(['push-gate: git push の承認を待っています'])

  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ plugin: 'push-gate', ...BAND, surface } as never)
    expect(await ui.find({ type: 'Text', text: /git push origin main/ })).toBeDefined()
    expect(await ui.find({ key: 'approve' })).toBeDefined()
    await ui.unmount()
  }
})

test('画面がない（VS Code 拡張機能など）ときは、ボタンには触れずコマンドでの承認だけを案内する', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  world.surfaces = []
  await $.session.start(SESSION)

  const ran = await $.tool.call(bash('git push origin main'))

  expect(ran.deny).toContain('/push-gate approve と打って承認')
  expect(ran.deny).not.toContain('入力欄の上の「承認」ボタン')
  expect(world.ran).toEqual([])
})

test('承認ボタンで実行を頼み、同じコマンドを 1 回だけ通す', async ($, on) => {
  const world = worldOf(on)
  const clock = mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('git push origin main'))

  const ui = await $.ui.mount({ plugin: 'push-gate', ...BAND } as never)
  await ui.press({ key: 'approve' })
  await ui.unmount()
  await clock.advance(1)

  expect(world.submitted).toHaveLength(1)
  expect(world.submitted[0]).toContain('git push origin main')

  expect((await $.tool.call(bash('git push origin main'))).deny).toBeUndefined()
  expect((await $.tool.call(bash('git push origin main'))).deny).toBeDefined()
  expect(world.ran).toEqual(['git push origin main'])
})

test('承認と違うコマンドは通さない', async ($, on) => {
  worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('git push origin main'))
  await $.command.run(typed('approve'))

  expect((await $.tool.call(bash('git push --force origin main'))).deny).toBeDefined()
})

test('承認は 10 分で切れる', async ($, on) => {
  worldOf(on)
  const clock = mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('git push'))
  await $.command.run(typed('approve'))
  await clock.advance(11 * 60 * 1_000)

  expect((await $.tool.call(bash('git push'))).deny).toBeDefined()
})

test('人が入力したのでなければ /push-gate approve を受け付けない', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('git push'))

  const done = await $.command.run({ command: 'push-gate', args: 'approve', origin: { kind: 'plugin', name: 'other' } } as never)

  expect(done.text).toContain('人が入力したときだけ')
  expect((await $.tool.call(bash('git push'))).deny).toBeDefined()
  expect(world.submitted).toEqual([])
})

test('却下すると実行しないよう伝え、帯を消す', async ($, on) => {
  const world = worldOf(on)
  const clock = mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('gh pr merge 12'))
  await $.command.run(typed('reject'))
  await clock.advance(1)

  expect(world.submitted[0]).toContain('実行しないでください')

  const ui = await $.ui.mount({ plugin: 'push-gate', ...BAND } as never)
  expect(await ui.find({ key: 'approve' })).toBeUndefined()
  await ui.unmount()
})

test('対象でないコマンドはそのまま通す', async ($, on) => {
  const world = worldOf(on)
  mock.clock(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('git status'))

  expect(world.ran).toEqual(['git status'])
})
