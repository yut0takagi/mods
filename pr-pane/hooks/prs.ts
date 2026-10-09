/** gh pr list の出力を読み、PR ごとの CI をまとめる。$ に触れない部分。 */

import type { Board, Cause, Check, Pr } from '../types'

export const FIELDS = 'number,title,headRefName,baseRefName,isDraft,reviewDecision,url,author,statusCheckRollup'

/** statusCheckRollup の 1 件。CheckRun は status と conclusion、StatusContext は state を持つ。 */
type Rollup = { status?: string; conclusion?: string; state?: string }

type Raw = {
  number: number
  title: string
  headRefName: string
  baseRefName: string
  isDraft: boolean
  reviewDecision: string | null
  url: string
  author: { login: string } | null
  statusCheckRollup: Rollup[] | null
}

const FAILED = new Set(['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'ERROR'])

export function checkOf(rollup: readonly Rollup[] | null): Check {
  if (rollup === null || rollup.length === 0) {
    return 'none'
  }

  let isPending = false

  for (const one of rollup) {
    const result = one.conclusion || one.state || ''

    if (FAILED.has(result)) {
      return 'fail'
    }

    if ((one.status !== undefined && one.status !== 'COMPLETED') || result === '' || result === 'PENDING' || result === 'EXPECTED') {
      isPending = true
    }
  }

  return isPending ? 'pending' : 'pass'
}

export function parsePrs(stdout: string): Pr[] {
  return (JSON.parse(stdout) as Raw[]).map(raw => ({
    number: raw.number,
    title: raw.title,
    head: raw.headRefName,
    base: raw.baseRefName,
    author: raw.author?.login ?? '',
    isDraft: raw.isDraft,
    review: raw.reviewDecision ?? '',
    url: raw.url,
    check: checkOf(raw.statusCheckRollup),
  }))
}

export const MARK: Record<Check, string> = { pass: '✓', fail: '✗', pending: '○', none: '·' }

export const REVIEW: Record<string, string> = {
  APPROVED: '承認済み',
  CHANGES_REQUESTED: '修正依頼',
  REVIEW_REQUIRED: 'レビュー待ち',
}

/** ステータス行の 1 行。CI の結果ごとの件数を、ある分だけ並べる。 */
export function summaryOf(prs: readonly Pr[]): string {
  const counts = (['fail', 'pending', 'pass'] as const)
    .map(check => [check, prs.filter(pr => pr.check === check).length] as const)
    .filter(([, n]) => n > 0)
    .map(([check, n]) => `${MARK[check]}${n}`)

  return [`PR ${prs.length}`, ...counts].join(' ')
}

/** PR の 2 行目。ブランチ・作者・draft・レビューの状態を、ある分だけ並べる。 */
export function detailOf(pr: Pr): string {
  return [`${pr.head} → ${pr.base}`, `@${pr.author}`, pr.isDraft ? 'draft' : '', REVIEW[pr.review] ?? '']
    .filter(part => part !== '')
    .join(' · ')
}

/** gh のエラー出力の最初の行。 */
export const firstLine = (text: string) => text.trim().split('\n')[0] ?? ''

/** gh pr list が 0 以外で終わったわけを、エラー出力から見分ける。 */
export function causeOf(stderr: string): Cause {
  // remote が GitHub を向いていないときの文言にも gh auth login が入るので、リポジトリを先に見る
  if (/not a git repository|no git remotes found|known GitHub host/i.test(stderr)) {
    return 'no-repo'
  }

  if (/gh auth login|GH_TOKEN|HTTP 401|could not find any host configurations/i.test(stderr)) {
    return 'no-auth'
  }

  return 'other'
}

/** 時刻を HH:MM で。 */
export function clockOf(ms: number): string {
  const at = new Date(ms)

  return `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`
}

/** 画面がないときの返答で、色の代わりに CI の結果を言葉で添える。 */
export const CI: Record<Check, string> = { pass: 'CI 成功', fail: 'CI 失敗', pending: 'CI 実行中', none: 'CI なし' }

const HINT: Record<Cause, string> = {
  'no-gh': 'gh（GitHub CLI）を起動できませんでした。gh が入っていて PATH が通っているかを確かめてください（https://cli.github.com）。',
  timeout: 'gh pr list が時間内に終わりませんでした。少し待ってから /prs で取り直してください。',
  'no-auth': 'gh にログインしていません。ターミナルで gh auth login を実行してから、/prs で取り直してください。',
  'no-repo': 'GitHub のリポジトリではないため、PR を取れません。git のリポジトリの中で、remote が GitHub を向いているかを確かめてください。',
  other: 'gh pr list が失敗しました。',
}

/**
 * 画面がないセッションでの /prs の返答。ステータス行の要約を先頭に置き、ペインと同じ中身を行で並べる。
 * Markdown として描かれても崩れないよう、まとまりの間は空行で区切り、PR は箇条書きにする。
 */
export function textOf(board: Board | null, base: string): string {
  if (board === null) {
    return 'PR をまだ取れていません。少し待ってから /prs をもう一度実行してください。'
  }

  const when = [base === '' ? '' : `宛先 ${base}`, `${clockOf(board.fetchedAt)} 時点`].filter(part => part !== '').join('・')

  if (board.error !== undefined) {
    return [`PR を取れませんでした（${when}）`, HINT[board.cause ?? 'other'], `詳細: ${board.error}`].join('\n\n')
  }

  const head = `${summaryOf(board.prs)}（${when}）`

  if (board.prs.length === 0) {
    return `${head}\n\n開いている PR はありません。`
  }

  const items = board.prs.map(pr => `- ${MARK[pr.check]} #${pr.number} ${pr.title}（${CI[pr.check]} · ${detailOf(pr)}）\n  ${pr.url}`)

  return [head, '', ...items].join('\n')
}
