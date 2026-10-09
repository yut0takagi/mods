import { describe, expect, test } from 'claude-code/testing'

import { excludedText, isIsolated, shieldGit, type Situation, skipReasonOf } from '../hooks/judge'

/** VS Code 拡張機能から始めたセッション。SDK 経由で起動するので画面は空になる。 */
const VSCODE: Situation = { turns: 0, surfaces: [], entrypoint: 'claude-vscode', cwd: '/w/repo', root: '/w/repo' }

describe('ワークツリーに入るかの判定', () => {
  test('メインの作業ツリーで始めた最初のプロンプトなら入る', () => {
    expect(skipReasonOf(VSCODE)).toBeNull()
    expect(skipReasonOf({ ...VSCODE, surfaces: ['terminal'], entrypoint: 'cli' })).toBeNull()
    expect(skipReasonOf({ ...VSCODE, cwd: '/w/repo/src' })).toBeNull()
  })

  test('2 通目からは入らない。再開したセッションも同じ', () => {
    expect(skipReasonOf({ ...VSCODE, turns: 1 })).toBe('最初のプロンプトではない')
  })

  test('人のいないセッションでは入らない', () => {
    expect(skipReasonOf({ ...VSCODE, entrypoint: 'sdk-cli' })).toBe('人のいないセッション（claude -p など）')
    expect(skipReasonOf({ ...VSCODE, entrypoint: null })).toBe('人のいないセッション（claude -p など）')
  })

  test('git の外では入らない', () => {
    expect(skipReasonOf({ ...VSCODE, cwd: '/w/notes', root: null })).toBe('git リポジトリの外')
  })

  test('すでにワークツリーの中なら入らない', () => {
    expect(skipReasonOf({ ...VSCODE, cwd: '/w/repo/.claude/worktrees/bright-fox' })).toBe('すでにワークツリーの中')
    expect(skipReasonOf({ ...VSCODE, cwd: '/w/repo-feature' })).toBe('すでにワークツリーの中')
  })
})

describe('除外ファイルへの追記', () => {
  test('なければ末尾に足す。改行のない末尾も崩さない', () => {
    expect(excludedText('')).toBe('/.claude/worktrees/\n')
    expect(excludedText('# git ls-files --others\n*.log\n')).toBe('# git ls-files --others\n*.log\n/.claude/worktrees/\n')
    expect(excludedText('*.log')).toBe('*.log\n/.claude/worktrees/\n')
  })

  test('もう除外されていれば足さない', () => {
    expect(excludedText('/.claude/worktrees/\n')).toBeNull()
    expect(excludedText('.claude/\n')).toBeNull()
    expect(excludedText('  .claude/worktrees  \n')).toBeNull()
  })
})

describe('隔離されたセッションと rtk の書き換え', () => {
  test('Claude Code が作ったワークツリーの中だけを隔離とみなす', () => {
    expect(isIsolated('/w/repo/.claude/worktrees/bright-fox', '/w/repo')).toBe(true)
    expect(isIsolated('/w/repo/.claude/worktrees/bright-fox/src', '/w/repo')).toBe(true)
    expect(isIsolated('/w/repo/.claude/worktrees', '/w/repo')).toBe(false)
    expect(isIsolated('/w/repo', '/w/repo')).toBe(false)
    expect(isIsolated('/w/repo-feature', '/w/repo')).toBe(false)
    expect(isIsolated('/w/repo/.claude/worktrees/x', null)).toBe(false)
  })

  test('コマンドの位置にある git だけを \\git にする', () => {
    const cases: [string, string][] = [
      ['git status', '\\git status'],
      ['pwd && git branch --show-current', 'pwd && \\git branch --show-current'],
      ['cd sub; git diff | head', 'cd sub; \\git diff | head'],
      ['git status || git log -1', '\\git status || \\git log -1'],
      ['git add a\ngit commit -m x', '\\git add a\n\\git commit -m x'],
      ['GIT_PAGER=cat git log -1', 'GIT_PAGER=cat \\git log -1'],
      ['env git status', 'env \\git status'],
      ['echo $(git rev-parse HEAD)', 'echo $(\\git rev-parse HEAD)'],
      ['for f in a b; do git add "$f"; done', 'for f in a b; do \\git add "$f"; done'],
      // 引用符の中は変えない
      ['git commit -m "fix git; git hook"', '\\git commit -m "fix git; git hook"'],
      ["git commit -m 'a && git b'", "\\git commit -m 'a && git b'"],
    ]

    for (const [command, shielded] of cases) {
      expect(shieldGit(command)).toBe(shielded)
    }
  })

  test('引数の git、引用符の中、コメント、ヒアドキュメントの中身、git でない語は変えない', () => {
    for (const command of [
      'echo git status',
      "echo 'git status'",
      'echo "a; git status"',
      '# git status',
      'cat <<EOF > a.sh\ngit status\nEOF',
      'rtk git status',
      '\\git status',
      'gitk --all',
      'git-lfs pull',
      'echo "unterminated; git status',
    ]) {
      expect(shieldGit(command)).toBe(command)
    }
  })
})
