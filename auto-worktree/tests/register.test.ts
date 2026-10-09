import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

/** VS Code 拡張機能から始めたセッション。SDK 経由で起動するので画面はない。 */
const SESSION = { surface: null, isInteractive: false, cwd: '/w/repo' } as const
const WORKTREE = '/w/repo/.claude/worktrees/bright-fox'

/** 人が入力欄から送ったプロンプト。 */
const typed = (text: string) => ({ text, wait: false, origin: { kind: 'composer' } }) as const

/**
 * セッションと EnterWorktree を手元で真似る。
 * `enter` を書き換えると、EnterWorktree の答え方が変わる。
 * 設定ファイルの PreToolUse には rtk のフックの代わりを置く（git と cargo を `rtk …` に書き換えて自動で許可する）。
 */
function worldOf(on: On) {
  const world = {
    turns: 0,
    surfaces: [] as string[],
    entrypoint: 'claude-vscode' as string | undefined,
    cwd: '/w/repo',
    root: '/w/repo' as string | null,
    enter: 'ok' as 'ok' | 'deny' | 'error' | 'throw',
    entered: 0,
    toasts: [] as string[],
    /** メインのチェックアウトの除外ファイル（.git/info/exclude）の中身。 */
    exclude: '# git ls-files --others --exclude-from=.git/info/exclude\n',
    /** モデルに届いたプロンプトの添え書き。 */
    contexts: [] as (readonly string[] | undefined)[],
    /** フックを通ったあと、実際に走った Bash のコマンド。 */
    ran: [] as string[],
  }

  on('session.turns', () => ({ value: world.turns }))
  on('session.surfaces', () => ({ value: world.surfaces }) as never)
  on('env.get', ($, e) => ({ value: e.name === 'CLAUDE_CODE_ENTRYPOINT' ? world.entrypoint : undefined }))
  on('session.cwd', () => ({ value: world.cwd }))
  on('session.repo', () => ({ value: world.root === null ? null : { root: world.root, remote: null, internal: false, name: null } }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('process.run', () => ({
    value: { exitCode: 0, stdout: '.git/info/exclude\n', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
  }))
  on('fs.read', ($, e) => {
    if (e.path !== '/w/repo/.git/info/exclude') {
      throw new Error(`ENOENT: ${e.path}`)
    }

    return { value: world.exclude }
  })
  on('fs.write', ($, e) => {
    if (e.path === '/w/repo/.git/info/exclude') {
      world.exclude = e.text
    }

    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('prompt.submit', ($, e) => {
    world.contexts.push(e.context)

    return { text: e.text }
  })
  on('tool.call', { tool: 'EnterWorktree' }, () => {
    world.entered++

    switch (world.enter) {
      case 'deny':
        return { deny: '許可されませんでした' }
      case 'error':
        return { isError: true, result: undefined, text: 'not a git repository' } as never
      case 'throw':
        throw new Error('no such tool')
      default:
        world.cwd = WORKTREE

        return { result: { worktreePath: WORKTREE, worktreeBranch: 'worktree-bright-fox', message: '' } } as never
    }
  })
  // rtk のフックの代わり。書き換えるものがなければ何も返さない
  on('classic.PreToolUse', ($, e) => {
    if (e.tool !== 'Bash') {
      return {}
    }

    const command = e.command.replace(/(^|&&\s*)(git|cargo)\b/g, '$1rtk $2')

    return command === e.command ? {} : { allow: true, updatedInput: { ...e, command }, additionalContext: ['RTK auto-rewrite'] }
  })
  on('tool.call', { tool: 'Bash' }, ($, e) => {
    world.ran.push(e.command)

    return { result: { stdout: '', stderr: '', interrupted: false } } as never
  })

  return world
}

const bash = (command: string) => ({ tool: 'Bash' as const, command })

test('最初のプロンプトでワークツリーに入り、移ったことをモデルに添えて伝える', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  await $.prompt.submit(typed('直して'))

  expect(world.entered).toBe(1)
  expect(world.toasts).toEqual([`ワークツリーで始めます: ${WORKTREE}`])
  expect(world.contexts[0]?.at(-1)).toContain(`${WORKTREE}（ブランチ worktree-bright-fox）`)
  // トーストの出ない画面でも人に伝わるよう、返答で知らせることを頼む
  expect(world.contexts[0]?.at(-1)).toContain('最初の返答の冒頭で')
})

test('作ったワークツリーがメインの git status に出ないよう、除外ファイルに一度だけ足す', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  await $.prompt.submit(typed('直して'))
  // 別のセッションでもう一度入っても、同じ行は重ねない
  world.cwd = '/w/repo'
  await $.prompt.submit(typed('別の作業'))

  expect(world.exclude).toBe('# git ls-files --others --exclude-from=.git/info/exclude\n/.claude/worktrees/\n')
})

test('2 通目からは何もしない', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.turns = 1
  await $.prompt.submit(typed('続けて'))

  expect(world.entered).toBe(0)
  expect(world.contexts[0]).toBeUndefined()
})

test('人のいないセッションと git の外では入らない', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  world.entrypoint = 'sdk-cli'
  await $.prompt.submit(typed('a'))
  world.entrypoint = 'claude-vscode'
  world.root = null
  await $.prompt.submit(typed('b'))

  expect(world.entered).toBe(0)
})

test('入れなかったら理由をトーストで出し、プロンプトは元の場所でそのまま送る', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  for (const enter of ['deny', 'error', 'throw'] as const) {
    world.enter = enter
    await $.prompt.submit(typed('直して'))
  }

  expect(world.toasts.slice(0, 2)).toEqual([
    'ワークツリーに入れませんでした: 許可されませんでした',
    'ワークツリーに入れませんでした: not a git repository',
  ])
  // 呼び出しが失敗したときの文言はエンジン次第なので、出たことだけを見る
  expect(world.toasts[2]).toMatch(/^ワークツリーに入れませんでした: /)
  expect(world.contexts).toEqual([undefined, undefined, undefined])
})

test('/auto-worktree で判定と理由を出す', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  const before = await $.command.run({ command: 'auto-worktree', args: '', origin: { kind: 'composer' } } as never)
  world.turns = 3
  const after = await $.command.run({ command: 'auto-worktree', args: '', origin: { kind: 'composer' } } as never)

  expect(before.text).toContain('次のプロンプトでワークツリーに入ります。')
  expect(after.text).toContain('ワークツリーには入りません（最初のプロンプトではない）。')
  expect(after.text).toContain('画面: なし')
  expect(after.text).toContain('起動元: claude-vscode')
})

test('ワークツリーの中では、git を rtk のフックが書き換えない \\git にしてから渡す', async ($, on) => {
  const world = worldOf(on)
  world.cwd = WORKTREE
  await $.session.start(SESSION)

  await $.tool.call(bash('git status'))
  await $.tool.call(bash('pwd && git branch --show-current'))
  // git でないものは rtk がそのまま書き換える。モデルが自分で書いた rtk git には手を出さない
  await $.tool.call(bash('cargo test'))
  await $.tool.call(bash('rtk git log'))

  expect(world.ran).toEqual(['\\git status', 'pwd && \\git branch --show-current', 'rtk cargo test', 'rtk git log'])
})

test('ワークツリーの外では、git に手を出さない', async ($, on) => {
  const world = worldOf(on)
  await $.session.start(SESSION)

  await $.tool.call(bash('git status'))
  world.cwd = '/w/repo-feature'
  await $.tool.call(bash('git status'))

  expect(world.ran).toEqual(['rtk git status', 'rtk git status'])
})
