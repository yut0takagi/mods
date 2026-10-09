import { expect, mock, test } from 'claude-code/testing'
import type { On, RenderInput } from 'claude-code'

import type { Peer } from '../types'

const SESSION = { surface: 'terminal', isInteractive: true, cwd: '/w/repo' } as const
const ID = 'aaaaaaaa-1111-2222-3333-444444444444'
const REGISTRY = '/h/.claude/branch-watch/sessions'
const NOW = 1_800_000_000_000

const PANE: RenderInput<'Pane'> = {
  component: 'Pane',
  surface: 'terminal',
  requestId: 'branch-watch',
  viewport: { columns: 180, rows: 48, isFullscreen: true },
  props: { title: 'セッションと worktree', isFocused: false, bodyColumns: 70, placement: 'dock', scroll: { offset: 0, bodyRows: 44 }, view: {} },
}

const ok = (stdout: string) => ({
  value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
})

/**
 * git・共有のディレクトリ・画面を手元で真似る。
 * `repos` のブランチを書き換えると、別のセッションが切り替えたことになる。
 */
function worldOf(on: On) {
  const clock = mock.clock(on, { now: NOW })
  const world = {
    clock,
    /** worktree のルートから今のブランチへ。detached HEAD なら `HEAD`。 */
    repos: { '/w/repo': 'feature/a', '/w/other': 'main' } as Record<string, string>,
    /** まだコミットのない worktree のルート。HEAD をコミットとして解決できない。 */
    unborn: [] as string[],
    cwd: '/w/repo',
    messages: [] as { role: 'user' | 'assistant'; text: string; toolUses: [] }[],
    /** セッションが描く画面。VS Code の拡張機能のセッションでは空。 */
    surfaces: ['terminal'] as string[],
    isPaneShown: true,
    /** 共有のディレクトリ。パスから中身と書いた時刻へ。 */
    files: {} as Record<string, { text: string; mtimeMs: number }>,
    removed: [] as string[],
    statuses: [] as (string | undefined)[],
    toasts: [] as string[],
    ran: [] as string[],
    opened: [] as string[],
    /** モデルに届いたプロンプトの添え書き。 */
    contexts: [] as (readonly string[] | undefined)[],
  }

  const rootOf = (dir: string | undefined) =>
    Object.keys(world.repos).find(root => dir === root || dir?.startsWith(`${root}/`))

  on('process.run', ($, e) => {
    if (e.argv[0] === 'rm') {
      for (const path of e.argv.slice(2)) {
        world.removed.push(path)
        delete world.files[path]
      }

      return ok('')
    }

    const root = rootOf(e.init?.cwd)
    const args = e.argv.slice(1).join(' ')
    const fail = (exitCode: number, stderr: string) => ({
      value: { exitCode, stdout: '', stderr, isStdoutTruncated: false, isStderrTruncated: false },
    })

    if (root === undefined) {
      return fail(128, 'not a git repository')
    }

    // 本物の git と同じく、symbolic-ref はコミットがなくてもブランチ名を返し、detached HEAD なら 1 で終わる
    if (args === 'symbolic-ref --short -q HEAD') {
      return world.repos[root] === 'HEAD' ? fail(1, '') : ok(`${world.repos[root]}\n`)
    }

    // HEAD をコミットとして解決する rev-parse は、コミットがないと失敗する
    if (args.startsWith('rev-parse') && args.endsWith(' HEAD') && world.unborn.includes(root)) {
      return fail(128, "fatal: ambiguous argument 'HEAD': unknown revision")
    }

    return args === 'rev-parse --show-toplevel' ? ok(`${root}\n`) : ok(`${root}\n${world.repos[root]}\n`)
  })
  on('env.get', ($, e) => ({ value: e.name === 'HOME' ? '/h' : undefined }))
  on('session.id', () => ({ value: ID }))
  on('session.cwd', () => ({ value: world.cwd }))
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  on('session.messages', () => ({ value: world.messages }) as never)
  on('fs.write', ($, e) => {
    world.files[e.path] = { text: e.text, mtimeMs: clock.now() }

    return { value: undefined }
  })
  on('fs.list', ($, e) => ({
    value: Object.entries(world.files)
      .filter(([path]) => path.startsWith(`${e.path}/`))
      .map(([path, file]) => ({ name: path.slice(e.path.length + 1), kind: 'file' as const, size: file.text.length, mtimeMs: file.mtimeMs, isLink: false })),
  }))
  on('fs.read', ($, e) => {
    const file = world.files[e.path]

    if (file === undefined) {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: file.text }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.status', ($, e) => {
    world.statuses.push(e.text)

    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    world.opened.push(e.id)

    return { value: world.isPaneShown ? { isPlaced: true } : { isPlaced: false, reason: 'narrow' } } as never
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('prompt.submit', ($, e) => {
    world.contexts.push(e.context)

    return { text: e.text }
  })
  on('turn.complete', () => ({ text: '' }))
  on('tool.call', ($, e) => {
    if (e.tool === 'Bash') {
      world.ran.push(e.command)

      const checkout = /checkout (?:-b )?(\S+)/.exec(e.command)
      const root = rootOf(world.cwd)

      if (checkout?.[1] !== undefined && root !== undefined) {
        world.repos[root] = checkout[1]
      }
    }

    return { result: { stdout: '', stderr: '', interrupted: false } } as never
  })

  return world
}

type World = ReturnType<typeof worldOf>

/** ほかのセッションが共有のディレクトリに書いたことにする。`ageMs` だけ前に書いたもの。 */
function peerOf(world: World, peer: Partial<Peer> & { id: string }, ageMs = 0) {
  const updatedAt = world.clock.now() - ageMs
  const full: Peer = { label: '', dir: peer.root ?? '/h', isWorking: false, updatedAt, ...peer }
  world.files[`${REGISTRY}/${peer.id}.json`] = { text: JSON.stringify(full), mtimeMs: updatedAt }
}

const mine = (world: World) => JSON.parse(world.files[`${REGISTRY}/${ID}.json`]?.text ?? 'null') as Peer | null

const bash = (command: string) => ({ tool: 'Bash' as const, command })

/** 人が入力欄から送ったプロンプト。 */
const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } }) as const

test('開始時のブランチをステータス行に出す', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  expect(world.statuses.at(-1)).toBe('⎇ repo / feature/a')
})

test('コミットのないリポジトリでも、git のリポジトリとして扱う', async ($, on) => {
  const world = worldOf(on)
  world.unborn = ['/w/repo']
  world.repos['/w/repo'] = 'main'
  await $.session.start(SESSION)

  const done = await $.command.run({ command: 'branch-watch', args: '', origin: { kind: 'composer' } } as never)

  expect(world.statuses.at(-1)).toBe('⎇ repo / main')
  expect(done.text).toContain('/w/repo: main（基準どおり）')
  expect(done.text).not.toContain('git のリポジトリではありません')
})

test('detached HEAD は HEAD として扱い、ずれとして commit を止める', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'HEAD'
  const ran = await $.tool.call(bash('git commit -m x'))

  expect(ran.deny).toContain('feature/a から HEAD')
})

test('別のセッションが切り替えたブランチでは commit を止める', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  const ran = await $.tool.call(bash('git commit -m x'))

  expect(ran.deny).toContain('feature/a から feature/b')
  expect(world.ran).toEqual([])
})

test('このセッションが自分で切り替えたなら、それを基準にして commit を通す', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  await $.tool.call(bash('git checkout -b feature/c'))
  const ran = await $.tool.call(bash('git commit -m x'))

  expect(ran.deny).toBeUndefined()
  expect(world.ran).toEqual(['git checkout -b feature/c', 'git commit -m x'])
  expect(world.statuses.at(-1)).toBe('⎇ repo / feature/c')
})

test('待機中の切り替えは一度だけトーストで知らせる', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  await world.clock.advance(15_000)
  await world.clock.advance(15_000)

  expect(world.toasts).toEqual(['branch-watch: feature/a → feature/b に切り替わりました'])
  expect(world.statuses.at(-1)).toBe('⚠ ⎇ repo / feature/b（このセッションは feature/a）')
})

test('/branch-watch accept で今のブランチを基準にする', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  await $.command.run({ command: 'branch-watch', args: 'accept', origin: { kind: 'composer' } } as never)
  const ran = await $.tool.call(bash('git commit -m x'))

  expect(ran.deny).toBeUndefined()
})

test('人が入力したのでなければ accept を受け付けない', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  const done = await $.command.run({ command: 'branch-watch', args: 'accept', origin: { kind: 'plugin', name: 'other' } } as never)
  const ran = await $.tool.call(bash('git commit -m x'))

  expect(done.text).toContain('人が入力したときだけ')
  expect(ran.deny).toBeDefined()
})

test('シェルが移った先の worktree で commit を確かめる', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)
  await $.tool.call(bash('git -C /w/other status'))

  world.repos['/w/other'] = 'feature/x'
  world.cwd = '/w/other'
  const ran = await $.tool.call(bash('git commit -m x'))

  expect(ran.deny).toContain('main から feature/x')
})

test('自分の様子を共有のディレクトリに書き、ターンの途中かどうかも書く', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  expect(mine(world)).toMatchObject({ id: ID, root: '/w/repo', branch: 'feature/a', baseline: 'feature/a', isWorking: false })

  await $.turn.start({ text: 'README の\n誤字を直して', turnId: 't1' })
  expect(mine(world)).toMatchObject({ label: 'README の 誤字を直して', isWorking: true })

  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'completed' } as never)
  expect(mine(world)).toMatchObject({ label: 'README の 誤字を直して', isWorking: false })
})

test('名札は最初のプロンプトのまま変えない。再開したセッションはそれまでの最初のプロンプトから取る', async ($, on) => {
  const world = worldOf(on)
  world.messages = [
    { role: 'user', text: '<ide_selection>x</ide_selection>', toolUses: [] },
    { role: 'user', text: 'ログイン画面を直して', toolUses: [] },
  ]
  await $.session.start(SESSION)
  await $.turn.start({ text: 'はい', turnId: 't1' })

  expect(mine(world)?.label).toBe('ログイン画面を直して')
})

test('同じ worktree にいるほかのセッションの数をステータス行に出す。止まったセッションは数えない', async ($, on) => {
  const world = worldOf(on)
  peerOf(world, { id: 'bbbbbbbb-0000', root: '/w/repo', branch: 'feature/a' })
  peerOf(world, { id: 'cccccccc-0000', root: '/w/other', branch: 'main' })
  peerOf(world, { id: 'dddddddd-0000', root: '/w/repo', branch: 'feature/a' }, 2 * 60_000)
  await $.session.start(SESSION)

  expect(world.statuses.at(-1)).toBe('⎇ repo / feature/a 👥 +1')
})

test('10 分より古いファイルは消す', async ($, on) => {
  const world = worldOf(on)
  peerOf(world, { id: 'dddddddd-0000', root: '/w/repo' }, 11 * 60_000)
  await $.session.start(SESSION)

  expect(world.removed).toEqual([`${REGISTRY}/dddddddd-0000.json`])
})

test('編集したファイルの worktree を作業場所にする。git の外での編集では動かさない', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  await $.tool.call({ tool: 'Edit', file_path: '/w/other/src/a.ts', old_string: 'a', new_string: 'b' } as never)
  expect(world.statuses.at(-1)).toBe('⎇ other / main')
  expect(mine(world)).toMatchObject({ root: '/w/other', branch: 'main' })

  await $.tool.call({ tool: 'Write', file_path: '/h/.claude/memory/note.md', content: 'x' } as never)
  expect(mine(world)?.root).toBe('/w/other')
})

test('セッションが終わったら自分のファイルを消す', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: ID } as never)

  expect(world.removed).toEqual([`${REGISTRY}/${ID}.json`])
})

test('/branch-watch でペインを開き、worktree ごとにセッションを描く', async ($, on) => {
  const world = worldOf(on)
  peerOf(world, { id: 'bbbbbbbb-0000', root: '/w/repo', branch: 'feature/b', baseline: 'feature/a', label: 'テストを足して', isWorking: true })
  peerOf(world, { id: 'cccccccc-0000', root: '/w/other', branch: 'main', label: 'PR を見て' })
  peerOf(world, { id: 'eeeeeeee-0000', dir: '/h/notes', label: 'メモを整理' })
  await $.session.start(SESSION)
  await $.turn.start({ text: 'README を直して', turnId: 't1' })

  const done = await $.command.run({ command: 'branch-watch', args: '', origin: { kind: 'composer' } } as never)
  expect(world.opened).toEqual(['branch-watch'])
  expect(done.text).toContain('4 セッションをペインに出しました')

  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    const ui = await $.ui.mount({ plugin: 'branch-watch', ...PANE, surface } as never)

    expect(await ui.find({ type: 'Text', text: '⎇ repo / feature/a' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '⚠ 2 セッション' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'このセッション' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'README を直して' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '⚠ 基準は feature/a' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '⎇ other / main' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'cccccccc' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'git の外' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '/h/notes' })).toBeDefined()
    await ui.unmount()
  }
})

test('ペインを出せないときは、一覧を返答に出す', async ($, on) => {
  const world = worldOf(on)
  world.isPaneShown = false
  peerOf(world, { id: 'cccccccc-0000', root: '/w/other', branch: 'main', label: 'PR を見て' })
  await $.session.start(SESSION)

  const done = await $.command.run({ command: 'branch-watch', args: '', origin: { kind: 'composer' } } as never)

  expect(done.text).toContain('/w/repo: feature/a（基準どおり）')
  expect(done.text).toContain('⎇ other / main  /w/other')
  expect(done.text).toContain('○ 待機中 cccccccc PR を見て')
})

test('画面がないときは、ペインを開かずに、基準と今のブランチと一覧を返答に出す', async ($, on) => {
  const world = worldOf(on)
  // VS Code の拡張機能では ui.open が isPlaced: true を返しても描かれない。それに頼らないことを確かめる
  world.surfaces = []
  peerOf(world, { id: 'cccccccc-0000', root: '/w/other', branch: 'main', label: 'PR を見て' })
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  const done = await $.command.run({ command: 'branch-watch', args: '', origin: { kind: 'composer' } } as never)

  expect(world.opened).toEqual([])
  expect(done.text).toContain('/w/repo: いまは feature/b、このセッションの基準は feature/a')
  expect(done.text).toContain('⎇ repo / feature/b  /w/repo')
  expect(done.text).toContain('○ 待機中 このセッション ⚠ 基準は feature/a')
  expect(done.text).toContain('○ 待機中 cccccccc PR を見て')
  expect(done.text).not.toContain('ペインに出しました')
})

test('画面がないときは、待機中のずれを次のプロンプトに一度だけ添えてモデルに伝える', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  await $.session.start(SESSION)
  await $.prompt.submit(typed('直して'))

  world.repos['/w/repo'] = 'feature/b'
  await world.clock.advance(15_000)
  await $.prompt.submit(typed('続けて'))
  await $.prompt.submit(typed('テストも足して'))

  expect(world.contexts[0]).toBeUndefined()
  expect(world.contexts[1]?.at(-1)).toContain('基準 feature/a から feature/b に変わっています')
  expect(world.contexts[1]?.at(-1)).toContain('返答の冒頭でユーザーに一言伝えてください')
  expect(world.contexts[2]).toBeUndefined()
})

test('画面があるときはプロンプトに添えない', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  await $.prompt.submit(typed('続けて'))

  expect(world.contexts).toEqual([undefined])
})

test('画面がないときは、ターンの途中のずれをツールの結果に一度だけ添える。サブエージェントには添えない', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  await $.session.start(SESSION)
  await $.turn.start({ text: '直して', turnId: 't1' })

  world.repos['/w/repo'] = 'feature/b'
  const inAgent = await $.tool.call({ ...bash('ls'), agentId: 'a1' } as never)
  const first = await $.tool.call({ tool: 'Edit', file_path: '/w/repo/a.ts', old_string: 'a', new_string: 'b' } as never)
  const second = await $.tool.call(bash('ls'))

  expect(inAgent.context).toBeUndefined()
  expect(first.context?.at(-1)).toContain('基準 feature/a から feature/b に変わっています')
  expect(second.context).toBeUndefined()
})

test('commit を止めて伝えたずれと、返答で見せたずれは、次のプロンプトで繰り返さない', async ($, on) => {
  const world = worldOf(on)
  world.surfaces = []
  await $.session.start(SESSION)

  world.repos['/w/repo'] = 'feature/b'
  const ran = await $.tool.call(bash('git commit -m x'))
  await $.prompt.submit(typed('どうする？'))

  world.repos['/w/repo'] = 'feature/c'
  await $.command.run({ command: 'branch-watch', args: '', origin: { kind: 'composer' } } as never)
  await $.prompt.submit(typed('一覧を見た'))

  expect(ran.deny).toContain('feature/a から feature/b')
  expect(world.contexts).toEqual([undefined, undefined])
})
