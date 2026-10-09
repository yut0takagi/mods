/** 動いているセッションの一覧。共有のファイルの読み取りと、並べ方と、文言。$ に触れない部分。 */

import type { Peer } from '../types'
import { nameOf } from './git'

/** これより長く書かれていないセッションは止まったとみなす。各セッションは 15 秒ごとに書く。 */
export const LIVE_MS = 60_000

/** これより古いファイルは消す。落ちたセッションのぶんが溜まらないように。 */
export const PRUNE_MS = 10 * 60_000

const LABEL_LENGTH = 32

/** プロンプトから名札を作る。IDE などが足したタグの塊は除く。 */
export function labelOf(text: string): string {
  const plain = text
    .replace(/<([\w-]+)[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const chars = Array.from(plain)

  return chars.length > LABEL_LENGTH ? `${chars.slice(0, LABEL_LENGTH).join('')}…` : plain
}

const isText = (value: unknown): value is string => typeof value === 'string'

/** 共有のディレクトリから読んだ 1 ファイル。書いている途中で読んだなどで形が違えば undefined。 */
export function parsePeer(text: string): Peer | undefined {
  let value: Record<string, unknown>

  try {
    value = JSON.parse(text) as Record<string, unknown>
  } catch {
    return undefined
  }

  if (!isText(value.id) || !isText(value.dir) || typeof value.updatedAt !== 'number') {
    return undefined
  }

  return {
    id: value.id,
    label: isText(value.label) ? value.label : '',
    dir: value.dir,
    ...(isText(value.root) && { root: value.root }),
    ...(isText(value.branch) && { branch: value.branch }),
    ...(isText(value.baseline) && { baseline: value.baseline }),
    isWorking: value.isWorking === true,
    updatedAt: value.updatedAt,
  }
}

export const isLive = (peer: Peer, now: number) => now - peer.updatedAt < LIVE_MS

/** 同じ worktree で動いているほかのセッションの数。 */
export const countIn = (others: readonly Peer[], root: string) => others.filter(peer => peer.root === root).length

export type Group = {
  /** worktree のルート。git の外のセッションをまとめた組では無い。 */
  root?: string
  /** いちばん新しく書かれたセッションから見えたブランチ。 */
  branch?: string
  peers: Peer[]
}

/** worktree ごとにまとめる。自分のいる worktree が先頭、git の外は最後。組の中は自分が先頭。 */
export function groupsOf(peers: readonly Peer[], selfId: string): Group[] {
  const byRoot = new Map<string, Peer[]>()

  for (const peer of peers) {
    const key = peer.root ?? ''
    byRoot.set(key, [...(byRoot.get(key) ?? []), peer])
  }

  const rank = (root: string, members: readonly Peer[]) =>
    members.some(peer => peer.id === selfId) ? 0 : root === '' ? 2 : 1
  // ペインを描き直すたびに並びが入れ替わらないよう、時刻ではなく id で並べる
  const order = (a: Peer, b: Peer) => Number(b.id === selfId) - Number(a.id === selfId) || a.id.localeCompare(b.id)

  return [...byRoot]
    .sort(([a, ma], [b, mb]) => rank(a, ma) - rank(b, mb) || a.localeCompare(b))
    .map(([root, members]) => {
      const sorted = [...members].sort(order)

      if (root === '') {
        return { peers: sorted }
      }

      const freshest = members.reduce((a, b) => (b.updatedAt > a.updatedAt ? b : a))

      return { root, branch: freshest.branch, peers: sorted }
    })
}

export const titleOf = (group: Group) =>
  group.root === undefined ? 'git の外' : `⎇ ${nameOf(group.root)} / ${group.branch ?? '?'}`

export const whoOf = (peer: Peer, selfId: string) => (peer.id === selfId ? 'このセッション' : peer.id.slice(0, 8))

export const stateOf = (peer: Peer) => (peer.isWorking ? '● 作業中' : '○ 待機中')

/** そのセッションの基準ブランチからずれていれば、その文言。 */
export const driftOf = (peer: Peer) =>
  peer.baseline !== undefined && peer.branch !== peer.baseline ? `⚠ 基準は ${peer.baseline}` : undefined

/** ペインを出せないときに、コマンドの返答として出す一覧。 */
export function listText(groups: readonly Group[], selfId: string): string {
  return groups
    .flatMap(group => [
      group.root === undefined ? titleOf(group) : `${titleOf(group)}  ${group.root}`,
      ...group.peers.map(peer =>
        [
          ' ',
          stateOf(peer),
          whoOf(peer, selfId),
          peer.label,
          group.root === undefined ? peer.dir : '',
          driftOf(peer) ?? '',
        ]
          .filter(part => part !== '')
          .join(' '),
      ),
    ])
    .join('\n')
}
