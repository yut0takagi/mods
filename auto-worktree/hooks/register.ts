import type { EngineInterface, Register } from 'claude-code'

import { excludedText, isIsolated, shieldGit, type Situation, skipReasonOf } from './judge'

async function situationOf($: EngineInterface): Promise<Situation> {
  const [turns, surfaces, entrypoint, cwd, repo] = await Promise.all([
    $.session.turns(),
    $.session.surfaces(),
    $.env.get('CLAUDE_CODE_ENTRYPOINT'),
    $.session.cwd(),
    $.session.repo(),
  ])

  return { turns, surfaces, entrypoint: entrypoint ?? null, cwd, root: repo?.root ?? null }
}

const toastOf = ($: EngineInterface, text: string) => $.ui.toast(text, { timeoutMs: 10_000 })

/**
 * メインのチェックアウトの git status にワークツリーが出ないよう、このクローンの除外ファイル
 * （.git/info/exclude。コミットされない）に足す。うまくいかなくても作業は止めない。
 */
async function excludeWorktrees($: EngineInterface, root: string) {
  const ran = await $.process
    .run(['git', 'rev-parse', '--git-path', 'info/exclude'], { cwd: root, timeoutMs: 5_000 })
    .catch(() => undefined)

  if (ran?.exitCode !== 0) {
    return
  }

  const found = ran.stdout.trim()
  const path = found.startsWith('/') ? found : `${root}/${found}`
  const text = excludedText(await $.fs.read(path).catch(() => ''))

  if (text !== null) {
    await $.fs.write(path, text).catch(() => undefined)
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'auto-worktree',
      description: 'このセッションが最初のプロンプトでワークツリーに入るかどうかと、その理由を出す',
    })

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // 様子が読めないときも、プロンプトは止めずにそのまま送る
    const situation = await situationOf($).catch(() => null)

    if (situation === null || skipReasonOf(situation) !== null) {
      return next(e)
    }

    // モデルが EnterWorktree を呼ぶのと同じ呼び出し。権限の確認もそのまま通る。
    // 入れなくてもプロンプトは止めず、元の場所で始める
    let entered
    try {
      entered = await $.tool.call({ tool: 'EnterWorktree' })
    } catch (error) {
      toastOf($, `ワークツリーに入れませんでした: ${String(error)}`)

      return next(e)
    }

    if (entered.deny !== undefined || entered.isError) {
      toastOf($, `ワークツリーに入れませんでした: ${entered.deny ?? entered.text ?? '理由は不明'}`)

      return next(e)
    }

    const { worktreePath, worktreeBranch } = entered.result
    toastOf($, `ワークツリーで始めます: ${worktreePath}`)

    if (situation.root !== null) {
      await excludeWorktrees($, situation.root)
    }

    // プラグインからのツール呼び出しの結果はモデルに届かないので、移ったことを添えて伝える。
    // VS Code 拡張機能のセッションには画面がなくトーストが出ないため、返答でも人に知らせてもらう
    const branch = worktreeBranch === undefined ? '' : `（ブランチ ${worktreeBranch}）`
    const note = `このセッションは最初のプロンプトの前に、mod auto-worktree によってワークツリー ${worktreePath}${branch} へ移った。ファイルの読み書きとコマンドはこのワークツリーで行う。最初の返答の冒頭で、このワークツリーとブランチに移ったことを利用者に一言伝える。`

    return next({ ...e, context: [...(e.context ?? []), note] })
  })

  // ワークツリーに隔離されたセッションでは、どこで動くか読めない git を Claude Code が拒否する。
  // rtk のフック（設定ファイルの PreToolUse）が git を `rtk git` に書き換えると、それに当たって git が使えなくなる。
  // rtk のフックは改変すると rtk の整合性検査で全部止まり、classic.PreToolUse は組み込みのセキュリティ用プラグインが
  // user の mod を通さない。そこで rtk のフックより上の tool.call で、git を rtk が書き換えない `\git` にしておく
  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.tool === 'Bash' && /\bgit\b/.test(e.command) ? shieldGit(e.command) : undefined

    if (e.tool !== 'Bash' || command === undefined || command === e.command) {
      return next(e)
    }

    const [cwd, repo] = await Promise.all([$.session.cwd(), $.session.repo()]).catch(() => [null, null] as const)

    return cwd !== null && isIsolated(cwd, repo?.root ?? null) ? next({ ...e, command }) : next(e)
  })

  on('command.run', { command: 'auto-worktree' }, async $ => {
    const situation = await situationOf($)
    const why = skipReasonOf(situation)
    const lines = [
      why === null ? '次のプロンプトでワークツリーに入ります。' : `ワークツリーには入りません（${why}）。`,
      `ディレクトリ: ${situation.cwd}`,
      `リポジトリ: ${situation.root ?? 'なし'}`,
      `画面: ${situation.surfaces.join(', ') || 'なし'}`,
      `起動元: ${situation.entrypoint ?? 'なし'}`,
      `これまでのプロンプト: ${situation.turns} 通`,
    ]

    return { text: lines.join('\n') }
  })
}
