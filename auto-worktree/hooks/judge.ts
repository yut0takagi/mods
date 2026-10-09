/** 最初のプロンプトを送った時点のセッションの様子。 */
export type Situation = {
  /** 人がこれまでに送ったプロンプトの数。いま送ろうとしている 1 通目は数えない */
  turns: number
  /** セッションが描いている画面。`claude -p` と、SDK 経由で起動する VS Code 拡張機能では空 */
  surfaces: readonly string[]
  /** 起動元（環境変数 `CLAUDE_CODE_ENTRYPOINT`）。`claude -p` は `sdk-cli`、VS Code 拡張機能は `claude-vscode` */
  entrypoint: string | null
  /** セッションのディレクトリ */
  cwd: string
  /** リポジトリのメインの作業ツリーのルート。git の外なら null */
  root: string | null
}

/** 画面がなくても人が使っている起動元。 */
const ATTENDED_ENTRYPOINTS: ReadonlySet<string> = new Set(['claude-vscode'])

const isInside = (dir: string, root: string) => dir === root || dir.startsWith(`${root}/`)

/** メインのチェックアウトの git status にワークツリーが出ないよう、除外ファイルに足す行。 */
export const EXCLUDE_LINE = '/.claude/worktrees/'

/** これらのどれかがあれば、ワークツリーはもう除外されている。 */
const COVERING_LINES = ['.claude', '.claude/', '/.claude', '/.claude/', '.claude/worktrees', '.claude/worktrees/', '/.claude/worktrees', EXCLUDE_LINE]

/** 除外ファイルの中身に除外の行を足した結果。もう除外されていれば null。 */
export function excludedText(current: string): string | null {
  const lines = current.split('\n').map(line => line.trim())

  if (lines.some(line => COVERING_LINES.includes(line))) {
    return null
  }

  const base = current === '' || current.endsWith('\n') ? current : `${current}\n`

  return `${base}${EXCLUDE_LINE}\n`
}

/** ワークツリーに入らない理由を返す。入るなら null。 */
export function skipReasonOf(s: Situation): string | null {
  if (s.turns > 0) {
    return '最初のプロンプトではない'
  }

  if (s.surfaces.length === 0 && !ATTENDED_ENTRYPOINTS.has(s.entrypoint ?? '')) {
    return '人のいないセッション（claude -p など）'
  }

  if (s.root === null) {
    return 'git リポジトリの外'
  }

  // メインの作業ツリーの外にいるなら、別の場所に作ったワークツリーの中
  if (!isInside(s.cwd, s.root) || isInside(s.cwd, `${s.root}/.claude/worktrees`)) {
    return 'すでにワークツリーの中'
  }

  return null
}

/** Claude Code が作ったワークツリー（`<root>/.claude/worktrees/<名前>`）の中か。そこに入ったセッションは隔離される */
export const isIsolated = (cwd: string, root: string | null) =>
  root !== null && cwd.startsWith(`${root}/.claude/worktrees/`)

// コマンドの位置を保つ語。`env git …`、`do git …`、`{ git …; }` の git もコマンドとして見る
const KEEPS_START: ReadonlySet<string> = new Set(['env', 'time', '!', '{', 'if', 'then', 'elif', 'else', 'do', 'while', 'until'])
// 変数の代入（`GIT_PAGER=cat git log` の `GIT_PAGER=cat`）もコマンドの位置を保つ
const ASSIGNMENT = /^[A-Za-z_][A-Za-z0-9_]*=/
// コマンドの区切り。`&&` `||` `|` `;` `&`、改行、`(` と `$(` の後ろはコマンドの位置になる
const isOperator = (c: string) => c === ';' || c === '&' || c === '|' || c === '(' || c === '\n'
const isBlank = (c: string) => c === ' ' || c === '\t'

/** `from` にある引用符を閉じる位置。閉じていなければ -1。二重引用符の中では `\` が次の 1 字を守る */
function closingOf(text: string, from: number): number {
  const quote = text[from]

  for (let i = from + 1; i < text.length; i++) {
    if (quote === '"' && text[i] === '\\') {
      i++
    } else if (text[i] === quote) {
      return i
    }
  }

  return -1
}

/**
 * コマンドの位置にある git を `\git` にする。シェルにとっては同じ git で、Claude Code の権限ルールも git として当てるが、
 * rtk のフックはこの形を `rtk git` に書き換えない。引数の git と引用符の中は変えない。
 * ヒアドキュメント（`<<`）から先は中身がデータなので、そこから後ろには手を出さない。
 */
export function shieldGit(command: string): string {
  let out = ''
  let isCommandStart = true
  let i = 0

  while (i < command.length) {
    const c = command[i] ?? ''

    if (isBlank(c) || isOperator(c)) {
      out += c
      i++
      isCommandStart ||= isOperator(c)
      continue
    }

    if (command.startsWith('<<', i)) {
      return out + command.slice(i)
    }

    // 語の頭の # から行末まではコメント
    if (c === '#') {
      const end = command.indexOf('\n', i)
      out += end === -1 ? command.slice(i) : command.slice(i, end)
      i = end === -1 ? command.length : end
      continue
    }

    // 1 語を、引用符と `\` を飛ばしながら、空白か区切りまで読む
    const start = i

    while (i < command.length) {
      const d = command[i] ?? ''

      if (isBlank(d) || isOperator(d) || command.startsWith('<<', i)) {
        break
      }

      if (d === '\\') {
        i += 2
      } else if (d === "'" || d === '"') {
        const end = closingOf(command, i)

        if (end === -1) {
          return out + command.slice(start)
        }

        i = end + 1
      } else {
        i++
      }
    }

    const word = command.slice(start, i)
    out += isCommandStart && word === 'git' ? '\\git' : word
    isCommandStart = isCommandStart && (KEEPS_START.has(word) || ASSIGNMENT.test(word))
  }

  return out
}
