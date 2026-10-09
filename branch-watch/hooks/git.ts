/** Bash のコマンドの読み取りと、ステータス行・拒否の文言。$ に触れない部分。 */

export type Repo = {
  /** worktree のルート。基準ブランチはこれごとに持つ。 */
  root: string
  /** 今のブランチ。detached HEAD なら `HEAD`。 */
  branch: string
}

// `git -C <dir> commit` や、前に別のコマンドを付けた `command git commit` も拾う
const GIT = String.raw`\bgit\s+(?:-[Cc]\s+\S+\s+)*`
const COMMIT = new RegExp(`${GIT}commit\\b`)
const SWITCH = new RegExp(`${GIT}(?:checkout|switch)\\b|\\bgh\\s+pr\\s+checkout\\b`)
const GIT_DIR = /\bgit\s+-C\s+("[^"]*"|'[^']*'|\S+)/
const CD_DIR = /^\s*cd\s+("[^"]*"|'[^']*'|\S+)\s*(?:&&|;)/

export const isCommit = (command: string) => COMMIT.test(command)

/** このセッションが自分でブランチを切り替えるコマンドか。 */
export const isSwitch = (command: string) => SWITCH.test(command)

const unquote = (word: string) => word.replace(/^(["'])(.*)\1$/, '$2')

/** コマンドが git を走らせるディレクトリ。`git -C <dir>` と先頭の `cd <dir> &&` を読み、なければ cwd。 */
export function dirOf(command: string, cwd: string, home: string | undefined): string {
  const word = (GIT_DIR.exec(command) ?? CD_DIR.exec(command))?.[1]

  if (word === undefined) {
    return cwd
  }

  const dir = unquote(word)

  if (dir === '~' || dir.startsWith('~/')) {
    return home === undefined ? cwd : home + dir.slice(1)
  }

  return dir.startsWith('/') ? dir : `${cwd}/${dir}`
}

/**
 * `git rev-parse --show-toplevel` の出力と、`git symbolic-ref --short -q HEAD` の結果。
 * symbolic-ref はコミットがなくてもブランチ名を返し、detached HEAD なら出力なしの 1 で終わる。
 * それ以外の失敗（タイムアウトなど）を detached と取り違えると commit を止めてしまうので、分からないとする。
 */
export function parseRepo(toplevel: string, ref: { exitCode: number; stdout: string }): Repo | undefined {
  const root = toplevel.trim()
  const branch = ref.exitCode === 0 ? ref.stdout.trim() : ref.exitCode === 1 ? 'HEAD' : ''

  return root && branch ? { root, branch } : undefined
}

export const nameOf = (root: string) => root.split('/').pop() ?? root

/** 同じずれを何度も知らせないための鍵。`<root>@<branch>`。 */
export const keyOf = (repo: Repo) => `${repo.root}@${repo.branch}`

/** `others` は、同じ worktree で動いているほかのセッションの数。 */
export function statusText(repo: Repo, baseline: string, others = 0): string {
  const where = `⎇ ${nameOf(repo.root)} / ${repo.branch}`
  const text = repo.branch === baseline ? where : `⚠ ${where}（このセッションは ${baseline}）`

  return others > 0 ? `${text} 👥 +${others}` : text
}

export function denyText(repo: Repo, baseline: string): string {
  return [
    `branch-watch: ${repo.root} のブランチが ${baseline} から ${repo.branch} に変わっています。`,
    'このセッションが切り替えたものではないので、別のセッションが切り替えた可能性があります。commit は止めました。',
    `ユーザーに伝えて判断を仰いでください（${baseline} に戻すなら git checkout ${baseline}、今のブランチで続けるならユーザーが /branch-watch accept を実行する）。`,
  ].join('\n')
}

/**
 * 画面がないセッション（VS Code の拡張機能など）で、トーストの代わりにモデルへ添える文。
 * ユーザーにはステータス行もトーストも見えないので、返答で知らせてもらう。
 */
export function driftNote(repo: Repo, baseline: string): string {
  return [
    `branch-watch: ${repo.root} のブランチが、このセッションの基準 ${baseline} から ${repo.branch} に変わっています。`,
    'このセッションが切り替えたものではないので、別のセッションが切り替えた可能性があります。この画面にはステータス行もトーストも出ないため、ユーザーはまだ気づいていません。',
    `返答の冒頭でユーザーに一言伝えてください。戻すかどうかはユーザーが決めます（${baseline} に戻すなら git checkout ${baseline}、今のブランチで続けるならユーザーが /branch-watch accept を実行する）。`,
  ].join('\n')
}
