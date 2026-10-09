/** git の出力の読み方と、表示の整え方。$ に触れない部分。 */

import type { Patch, Stat } from '../types'

/** 覚えておくファイルの数。古いものから外す。 */
export const KEEP = 100

/** Code に渡せる長さ。 */
const MAX_SOURCE = 10_000

export const dirOf = (path: string) => path.slice(0, Math.max(1, path.lastIndexOf('/')))

/** `git diff --numstat` の 1 行目。バイナリ（`-`）は 0 とみなす。 */
export function parseNumstat(stdout: string): Stat {
  const [added, removed] = stdout.trim().split('\n')[0]?.split('\t') ?? []

  if (added === undefined || removed === undefined || added === '') {
    return null
  }

  return { added: Number(added) || 0, removed: Number(removed) || 0 }
}

/** unified diff の `@@` の行から後。最後の改行は落とす。 */
function bodyOf(stdout: string) {
  const start = stdout.indexOf('@@')

  return start === -1 ? '' : stdout.slice(start).replace(/\n$/, '')
}

/** unified diff を `@@` の行から始め、Code に渡せる長さで hunk の切れ目に切る。 */
export function patchOf(path: string, stdout: string): Patch {
  const body = bodyOf(stdout)

  if (body.length <= MAX_SOURCE) {
    return { path, text: body, isCut: false }
  }

  const cut = body.lastIndexOf('\n@@', MAX_SOURCE)

  return { path, text: body.slice(0, cut > 0 ? cut : MAX_SOURCE), isCut: true }
}

/** セッションのディレクトリの中なら相対パスで。 */
export const shortOf = (path: string, cwd: string) => (path.startsWith(`${cwd}/`) ? path.slice(cwd.length + 1) : path)

export const statText = (stat: Stat) => (stat === null ? '変更なし' : `+${stat.added} −${stat.removed}`)

/**
 * `/session-diff <パス>` のパスを、このセッションが編集したファイルの絶対パスに引き当てる。
 * 絶対パス、セッションのディレクトリからの相対パス、末尾が 1 つだけ合うもの（`a.ts`）の順に探す。
 * 編集していないファイルの中身は出さないよう、一覧にないものは null。
 */
export function pickOf(list: readonly string[], arg: string, cwd: string): string | null {
  const want = arg.trim().replace(/^\.\//, '')

  if (want === '') {
    return null
  }

  const full = want.startsWith('/') ? want : `${cwd}/${want}`

  if (list.includes(full)) {
    return full
  }

  const tails = list.filter(path => path.endsWith(`/${want}`))

  return tails.length === 1 ? (tails[0] ?? null) : null
}

const linesOf = (text: string) => (text === '' ? 0 : text.split('\n').length)

/** 中身のどの ` の並びより長い囲み。Markdown のコードブロックを含む差分でも途中で閉じないように。 */
const fenceOf = (text: string) => '`'.repeat(Math.max(3, ...(text.match(/`+/g) ?? []).map(run => run.length + 1)))

/**
 * 画面のないセッションで `/session-diff` が返す、編集したファイルと増減の一覧。
 * `missing` は引き当たらなかったパスで、渡すと一覧の前にそう書く。
 */
export function listText(list: readonly string[], all: Readonly<Record<string, Stat>>, cwd: string, missing?: string): string {
  const head = missing === undefined ? [] : [`このセッションで編集したファイルに \`${missing}\` はありません。`, '']

  if (list.length === 0) {
    return [...head, 'このセッションではまだ何も編集していません。'].join('\n')
  }

  return [
    ...head,
    `このセッションで編集したファイル（まだ commit していない変更）: ${list.length} 件`,
    '',
    ...list.map(path => `- ${path in all ? statText(all[path] ?? null) : '…'}  \`${shortOf(path, cwd)}\``),
    '',
    '差分は `/session-diff <パス>` で出します。',
  ].join('\n')
}

/**
 * 画面のないセッションで `/session-diff <パス>` が返す、1 ファイルの unified diff。
 * ペインと同じ長さで hunk の切れ目に切り、切ったときは何行のうち何行かを書く。
 */
export function patchText(path: string, stdout: string, stat: Stat, cwd: string): string {
  const name = `\`${shortOf(path, cwd)}\``
  const { text, isCut } = patchOf(path, stdout)

  if (text === '') {
    return `${name} にまだ commit していない変更はありません。`
  }

  const fence = fenceOf(text)
  const lines = [`${name} の差分（まだ commit していない変更${stat === null ? '' : ` ${statText(stat)}`}）`, '', `${fence}diff`, text, fence]

  if (isCut) {
    lines.push('', `長いので先頭だけ出しています（全 ${linesOf(bodyOf(stdout))} 行のうち ${linesOf(text)} 行）。`)
  }

  return lines.join('\n')
}
