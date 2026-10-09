import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderInput } from 'claude-code'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/w/repo' } as const

const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'pr-pane',
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: { title: 'PR', isFocused: false, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 44 }, view: {} },
}

const PRS = [
  {
    number: 39,
    title: 'Add a retry to the uploader',
    headRefName: 'fix/upload-retry',
    baseRefName: 'develop',
    isDraft: false,
    reviewDecision: 'APPROVED',
    url: 'https://github.com/o/r/pull/39',
    author: { login: 'octocat' },
    statusCheckRollup: [{ status: 'COMPLETED', conclusion: 'FAILURE' }],
  },
]

type Gh = { exitCode: number; stdout: string; stderr: string }

/** gh の代わり。関数を渡すと、呼ばれるたびにそれを待つ（投げれば gh を起動できなかったことになる）。 */
function worldOf(on: On, gh: Gh | (() => Promise<Gh>)) {
  const world = { argv: [] as string[][], statuses: [] as (string | undefined)[], opened: [] as string[], surfaces: ['terminal'] as string[], gh }

  on('process.run', async ($, e) => {
    world.argv.push([...e.argv])
    const out = typeof world.gh === 'function' ? await world.gh() : world.gh

    return { value: { ...out, isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', ($, e) => {
    world.statuses.push(e.text)

    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    world.opened.push(e.id)

    return { value: { isPlaced: true } } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))

  return world
}

test('画面がないときは、定期的には gh を呼ばず、/prs で頼まれたときだけ取る', async ($, on) => {
  const world = worldOf(on, { exitCode: 0, stdout: JSON.stringify(PRS), stderr: '' })
  const clock = mock.clock(on)
  world.surfaces = []
  await $.session.start(SESSION)
  await clock.advance(10 * 60 * 1_000)

  expect(world.argv).toEqual([])

  await $.command.run({ command: 'prs', args: '' } as never)

  expect(world.argv.length).toBe(1)
})

test('/prs でペインを開き、PR と CI を描く', async ($, on) => {
  const world = worldOf(on, { exitCode: 0, stdout: JSON.stringify(PRS), stderr: '' })
  mock.clock(on)
  await $.session.start(SESSION)
  const ran = await $.command.run({ command: 'prs', args: '' } as never)

  expect(ran.text).toBe('PR のペインを開きました。')
  expect(world.opened).toEqual(['pr-pane'])
  expect(world.statuses.at(-1)).toBe('PR 1 ✗1')

  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ plugin: 'pr-pane', ...PANE, surface } as never)

    expect(await ui.find({ type: 'Text', text: /Add a retry to the uploader/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /承認済み/ })).toBeDefined()
    await ui.unmount()
  }
})

test('宛先を設定すると gh に --base を渡す', { options: { base: 'develop' } }, async ($, on) => {
  const world = worldOf(on, { exitCode: 0, stdout: '[]', stderr: '' })
  mock.clock(on)
  await $.session.start(SESSION)
  await $.command.run({ command: 'prs', args: '' } as never)

  expect(world.argv.at(-1)?.slice(-2)).toEqual(['--base', 'develop'])
})

test('gh が失敗したらステータス行を消し、ペインに理由を出す', async ($, on) => {
  const world = worldOf(on, { exitCode: 1, stdout: '', stderr: 'no git remotes found\n' })
  mock.clock(on)
  await $.session.start(SESSION)
  await $.command.run({ command: 'prs', args: '' } as never)

  expect(world.statuses.at(-1)).toBeUndefined()

  const ui = await $.ui.mount({ plugin: 'pr-pane', ...PANE } as never)
  expect(await ui.find({ type: 'Text', text: /no git remotes found/ })).toBeDefined()
  await ui.unmount()
})

const typed = { command: 'prs', args: '', origin: { kind: 'composer' } } as never

test('画面がないとき /prs はペインを開かず、取り直した PR と CI をテキストで返す', async ($, on) => {
  const world = worldOf(on, { exitCode: 0, stdout: '[]', stderr: '' })
  world.surfaces = []
  const clock = mock.clock(on)
  await $.session.start(SESSION)
  await clock.settle()

  // セッションの始めに取ったあとで PR が増えても、/prs は取り直した中身を返す
  world.gh = { exitCode: 0, stdout: JSON.stringify(PRS), stderr: '' }
  const ran = await $.command.run(typed)

  expect(world.opened).toEqual([])
  expect(ran.text).toMatch(/^PR 1 ✗1（\d\d:\d\d 時点）\n\n/)
  expect(ran.text).toContain('- ✗ #39 Add a retry to the uploader（CI 失敗 · fix/upload-retry → develop · @octocat · 承認済み）')
  expect(ran.text).toContain('https://github.com/o/r/pull/39')
})

test('画面がないとき、gh にログインしていなければそう返す', async ($, on) => {
  const world = worldOf(on, {
    exitCode: 4,
    stdout: '',
    stderr: 'To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n',
  })
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  const ran = await $.command.run(typed)

  expect(ran.text).toContain('PR を取れませんでした')
  expect(ran.text).toContain('gh にログインしていません')
  expect(ran.text).toContain('詳細: To get started with GitHub CLI, please run:  gh auth login')
})

test('画面がないとき、GitHub のリポジトリでなければそう返す', async ($, on) => {
  const world = worldOf(on, { exitCode: 1, stdout: '', stderr: 'no git remotes found\n' })
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  const ran = await $.command.run(typed)

  expect(ran.text).toContain('GitHub のリポジトリではないため')
  expect(ran.text).toContain('詳細: no git remotes found')
})

test('画面がないとき、gh を起動できなければそう返す', async ($, on) => {
  const world = worldOf(on, async () => {
    throw new Error('spawn gh ENOENT')
  })
  world.surfaces = []
  mock.clock(on)
  await $.session.start(SESSION)
  const ran = await $.command.run(typed)

  expect(ran.text).toContain('gh（GitHub CLI）を起動できませんでした')
})

test('画面がないとき、gh が時間内に終わらなければそう返す', async ($, on) => {
  const clock = mock.clock(on)
  const world = worldOf(on, async () => {
    await clock.sleep(20_000)
    throw new Error('timed out')
  })
  world.surfaces = []
  await $.session.start(SESSION)
  const running = $.command.run(typed)
  await clock.settle()
  await clock.advance(20_000)

  expect((await running).text).toContain('時間内に終わりませんでした')
})
