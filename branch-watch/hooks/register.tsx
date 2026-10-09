import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ToolCallResult } from 'claude-code'

import type { Baselines, Peer } from '../types'
import { denyText, dirOf, driftNote, isCommit, isSwitch, keyOf, parseRepo, statusText } from './git'
import type { Repo } from './git'
import { countIn, driftOf, groupsOf, isLive, labelOf, listText, parsePeer, PRUNE_MS, stateOf, titleOf, whoOf } from './sessions'

// 基準は $.state に置く。モジュールの変数だと読み込み直しで消え、そのあいだの切り替えを見逃す
const baselines = atom({ plugin: 'branch-watch', key: 'baselines' } as const, {} as Baselines)
const warned = atom({ plugin: 'branch-watch', key: 'warned' } as const, '')
const noted = atom({ plugin: 'branch-watch', key: 'noted' } as const, '')
const here = atom({ plugin: 'branch-watch', key: 'here' } as const, '')
const label = atom({ plugin: 'branch-watch', key: 'label' } as const, { id: '', text: '' })
const working = atom({ plugin: 'branch-watch', key: 'isWorking' } as const, false)
const peers = atom({ plugin: 'branch-watch', key: 'peers' } as const, [] as Peer[])

const PANE = 'branch-watch'

// 待機中に別のセッションが切り替えたのも拾うため、ツール呼び出しのほかに一定間隔でも見る。
// 同じ間隔で自分の様子を共有のディレクトリに書き、ほかのセッションの様子を読む
const POLL_MS = 15_000

async function repoAt($: EngineInterface, dir: string): Promise<Repo | undefined> {
  const git = (args: string[]) => $.process.run(['git', ...args], { cwd: dir, timeoutMs: 5_000 }).catch(() => undefined)
  // `rev-parse --abbrev-ref HEAD` はコミットのないリポジトリで失敗するので、ルートとブランチは別々に聞く
  const [top, ref] = await Promise.all([git(['rev-parse', '--show-toplevel']), git(['symbolic-ref', '--short', '-q', 'HEAD'])])

  return top?.exitCode === 0 && ref !== undefined ? parseRepo(top.stdout, ref) : undefined
}

/** その worktree の基準ブランチ。初めて見る worktree なら今のブランチを基準にする。 */
async function baselineOf($: EngineInterface, repo: Repo): Promise<string> {
  const known = (await read($, baselines))[repo.root]

  if (known !== undefined) {
    return known
  }

  await update($, baselines, all => ({ ...all, [repo.root]: repo.branch }))

  return repo.branch
}

const accept = ($: EngineInterface, repo: Repo) =>
  update($, baselines, all => ({ ...all, [repo.root]: repo.branch }))

/** このセッションが作業している場所。まだどこでも作業していなければセッションの cwd。 */
const whereOf = async ($: EngineInterface) => (await read($, here)) || (await $.session.cwd())

/** 作業場所を `dir` の worktree に移す。git の外（~/.claude のメモなど）での作業では動かさない。 */
async function moveTo($: EngineInterface, dir: string) {
  const repo = await repoAt($, dir)

  if (repo !== undefined) {
    await update($, here, () => repo.root)
  }
}

/** セッションの様子を置くディレクトリ。どのセッションからも同じ場所になる。 */
async function registryOf($: EngineInterface): Promise<string | undefined> {
  const config = await $.env.get('CLAUDE_CONFIG_DIR')
  const home = await $.env.get('HOME')
  const base = config || (home === undefined ? undefined : `${home}/.claude`)

  return base === undefined ? undefined : `${base}/branch-watch/sessions`
}

/** 自分の様子を書き、動いているほかのセッションの様子を読む。古いファイルは消す。 */
async function exchange($: EngineInterface, registry: string, self: Peer): Promise<Peer[]> {
  await $.fs.write(`${registry}/${self.id}.json`, JSON.stringify(self)).catch(() => undefined)

  const before = await read($, peers)
  const entries = await $.fs.list(registry).catch(() => [])
  const files = entries.filter(entry => entry.kind === 'file' && entry.name.endsWith('.json') && entry.name !== `${self.id}.json`)
  const stale = files.filter(entry => self.updatedAt - entry.mtimeMs > PRUNE_MS).map(entry => `${registry}/${entry.name}`)

  if (stale.length > 0) {
    void $.process.run(['rm', '-f', ...stale], { timeoutMs: 5_000 }).catch(() => undefined)
  }

  const found = await Promise.all(
    files
      .filter(entry => self.updatedAt - entry.mtimeMs <= PRUNE_MS)
      .map(async entry => {
        const text = await $.fs.read(`${registry}/${entry.name}`).catch(() => undefined)
        const id = entry.name.slice(0, -'.json'.length)

        // 相手が書いている途中で読むと壊れていることがある。そのときは前に読んだものを使う
        return (text === undefined ? undefined : parsePeer(text)) ?? before.find(peer => peer.id === id)
      }),
  )

  return found.filter((peer): peer is Peer => peer !== undefined && isLive(peer, self.updatedAt))
}

/** ステータス行とセッションの一覧を今に合わせ、基準からずれたら一度だけ知らせる。 */
async function refresh($: EngineInterface) {
  const id = await $.session.id()
  const dir = await whereOf($)
  const repo = await repoAt($, dir)
  const baseline = repo === undefined ? undefined : await baselineOf($, repo)
  const named = await read($, label)
  const self: Peer = {
    id,
    label: named.id === id ? named.text : '',
    dir,
    ...(repo !== undefined && { root: repo.root, branch: repo.branch, baseline }),
    isWorking: await read($, working),
    updatedAt: await $.clock.now(),
  }
  const registry = await registryOf($)
  const others = registry === undefined ? [] : await exchange($, registry, self)
  await update($, peers, () => [self, ...others])

  if (repo === undefined || baseline === undefined) {
    $.ui.status(undefined)

    return
  }

  $.ui.status(statusText(repo, baseline, countIn(others, repo.root)))

  const key = keyOf(repo)

  if (repo.branch !== baseline && (await read($, warned)) !== key) {
    await update($, warned, () => key)
    $.ui.toast(`branch-watch: ${baseline} → ${repo.branch} に切り替わりました`, { timeoutMs: 8_000 })
  }
}

/**
 * 画面があるか。VS Code の拡張機能のセッションには無く、ペインもステータス行もトーストも描かれない
 * （ui.open は isPlaced: true を返すので、それでは見分けられない）。分からないときはあるとみなし、今までどおりにする。
 */
async function hasScreen($: EngineInterface): Promise<boolean> {
  const surfaces = await $.session.surfaces().catch(() => undefined)

  return surfaces === undefined || surfaces.length > 0
}

/** このずれはもう伝えたことにする。画面がないときの添え書きで同じことを繰り返さない。 */
const markNoted = ($: EngineInterface, repo: Repo) => update($, noted, () => keyOf(repo))

/**
 * 画面がないセッションで、基準からのずれをまだモデルに伝えていなければ、その添え書き。
 * トーストと同じく、同じずれは一度だけ伝える。
 */
async function noteOf($: EngineInterface): Promise<string | undefined> {
  if (await hasScreen($)) {
    return undefined
  }

  const repo = await repoAt($, await whereOf($))

  if (repo === undefined) {
    return undefined
  }

  const baseline = await baselineOf($, repo)

  if (repo.branch === baseline || (await read($, noted)) === keyOf(repo)) {
    return undefined
  }

  await markNoted($, repo)

  return driftNote(repo, baseline)
}

/**
 * ターンの途中に起きたずれを、ツールの結果に添えてモデルに伝える（画面がないときだけ）。
 * サブエージェントに伝えても人には届かないので、メインのループのぶんにだけ添える。
 */
async function withNote<T extends ToolCallResult>($: EngineInterface, agentId: string | undefined, ran: T): Promise<T> {
  if (agentId !== undefined || ran.deny !== undefined) {
    return ran
  }

  const note = await noteOf($).catch(() => undefined)

  return note === undefined ? ran : { ...ran, context: [...(ran.context ?? []), note] }
}

/** 名札がまだなければ付ける。再開したセッションは、それまでの最初のプロンプトから取る。 */
async function nameFrom($: EngineInterface, prompt?: string) {
  const id = await $.session.id()
  const named = await read($, label)

  if (named.id === id && named.text !== '') {
    return
  }

  const first =
    prompt ??
    (await $.session.messages().catch(() => []))
      .filter(message => message.role === 'user')
      .map(message => labelOf(message.text))
      .find(text => text !== '')
  const text = labelOf(first ?? '')

  if (text !== '') {
    await update($, label, () => ({ id, text }))
  }
}

const parentOf = (file: string) => file.slice(0, file.lastIndexOf('/')) || '/'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 画面がない（VS Code の拡張機能など）と、一覧は返答に出す。説明もそれに合わせる
    const where = (await hasScreen($)) ? 'ペイン' : '返答'
    await $.command.register({
      name: 'branch-watch',
      description: `セッションごとの worktree / branch を${where}に出す。accept で今のブランチを基準にする`,
      argumentHint: '[accept]',
    })
    await nameFrom($)
    await refresh($)
    $.clock.every(POLL_MS, () => void refresh($))

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    const registry = await registryOf($)

    if (registry !== undefined) {
      await $.process.run(['rm', '-f', `${registry}/${e.sessionId}.json`], { timeoutMs: 5_000 }).catch(() => undefined)
    }

    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await update($, working, () => true)
    await nameFrom($, e.text)
    await refresh($)

    return next(e)
  })

  // 画面がないと待機中のずれをトーストで知らせられないので、次のプロンプトに添えてモデルに伝え、返答で知らせてもらう
  on('prompt.submit', async ($, e, next) => {
    // 様子が読めないときも、プロンプトは止めずにそのまま送る
    const note = await noteOf($).catch(() => undefined)

    return next(note === undefined ? e : { ...e, context: [...(e.context ?? []), note] })
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    // サブエージェントのターンが終わっても、セッションのターンは続いている
    if (e.agentId === undefined) {
      await update($, working, () => false)
      await refresh($)
    }

    return done
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const dir = dirOf(e.command, await $.session.cwd(), await $.env.get('HOME'))

    if (isCommit(e.command)) {
      const repo = await repoAt($, dir)

      if (repo !== undefined) {
        const baseline = await baselineOf($, repo)

        if (repo.branch !== baseline) {
          // 拒否の文がずれを伝えるので、画面がないときの添え書きでは繰り返さない
          if (e.agentId === undefined) {
            await markNoted($, repo)
          }

          return { deny: denyText(repo, baseline) }
        }
      }
    }

    const ran = await next(e)

    // このセッションが自分で切り替えたなら、それを新しい基準にする
    if (isSwitch(e.command)) {
      const repo = await repoAt($, dir)

      if (repo !== undefined) {
        await accept($, repo)
      }
    }

    await moveTo($, dir)
    await refresh($)

    return withNote($, e.agentId, ran)
  })

  on('tool.call', async ($, e, next) => {
    const file =
      e.tool === 'Edit' || e.tool === 'Write' ? e.file_path : e.tool === 'NotebookEdit' ? e.notebook_path : undefined

    if (file === undefined) {
      return next(e)
    }

    const ran = await next(e)
    await moveTo($, parentOf(file))
    await refresh($)

    return withNote($, e.agentId, ran)
  })

  on('command.run', { command: 'branch-watch' }, async ($, e) => {
    const dir = await whereOf($)
    const repo = await repoAt($, dir)

    if (e.args.trim() === 'accept') {
      if (repo === undefined) {
        return { text: `${dir} は git のリポジトリではありません。` }
      }

      // 基準の付け替えは、人が入力したときだけ受け付ける（モデルやほかのプラグインからは通さない）
      if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') {
        return { text: 'branch-watch: 基準の付け替えは、人が入力したときだけ受け付けます。' }
      }

      await accept($, repo)
      await refresh($)

      return { text: `${repo.root} の基準を ${repo.branch} にしました。` }
    }

    await refresh($)

    const baseline = repo === undefined ? undefined : await baselineOf($, repo)
    const head =
      repo === undefined || baseline === undefined
        ? `${dir} は git のリポジトリではありません。`
        : repo.branch === baseline
          ? `${repo.root}: ${repo.branch}（基準どおり）`
          : `${repo.root}: いまは ${repo.branch}、このセッションの基準は ${baseline}`
    const list = await read($, peers)
    // 画面がないと ui.open は isPlaced: true を返すのに描かれない。そのときは開かずに一覧を返答に出す
    const opened = (await hasScreen($))
      ? await $.ui.open({ id: PANE, title: 'セッションと worktree' }).catch(() => ({ isPlaced: false }) as const)
      : ({ isPlaced: false } as const)

    // 返答で見せたずれは、次のプロンプトに添えて繰り返さない
    if (repo !== undefined && baseline !== undefined && repo.branch !== baseline) {
      await markNoted($, repo)
    }

    return {
      text: opened.isPlaced
        ? `${head}\n動いている ${list.length} セッションをペインに出しました。`
        : `${head}\n\n${listText(groupsOf(list, list[0]?.id ?? ''), list[0]?.id ?? '')}`,
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Button, Text } = $.ui.resolve(e)
    const list = await read($, peers)
    const selfId = list[0]?.id ?? ''

    return (
      <Box flexDirection="column">
        <Box gap={1}>
          <Text dimColor>{`動いているセッション ${list.length}`}</Text>
          <Button key="refresh" label="更新" onPress={() => refresh($)} />
        </Box>
        {groupsOf(list, selfId).map(group => (
          <Box key={`wt-${group.root ?? ''}`} flexDirection="column" marginTop={1}>
            <Box gap={1}>
              <Text bold wrap="truncate-end">
                {titleOf(group)}
              </Text>
              {group.root !== undefined && group.peers.length > 1 && (
                <Text color="yellow">{`⚠ ${group.peers.length} セッション`}</Text>
              )}
            </Box>
            {group.root !== undefined && (
              <Text dimColor wrap="truncate-start">
                {group.root}
              </Text>
            )}
            {group.peers.map(peer => (
              <Box key={`peer-${peer.id}`} gap={1}>
                <Text color={peer.isWorking ? 'green' : undefined} dimColor={!peer.isWorking}>
                  {stateOf(peer)}
                </Text>
                <Text bold={peer.id === selfId}>{whoOf(peer, selfId)}</Text>
                <Text wrap="truncate-end">{peer.label}</Text>
                {group.root === undefined && (
                  <Text dimColor wrap="truncate-start">
                    {peer.dir}
                  </Text>
                )}
                {driftOf(peer) !== undefined && <Text color="yellow">{driftOf(peer)}</Text>}
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}
