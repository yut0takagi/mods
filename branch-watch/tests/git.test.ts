import { describe, expect, test } from 'claude-code/testing'

import { denyText, dirOf, driftNote, isCommit, isSwitch, keyOf, parseRepo, statusText } from '../hooks/git'

describe('コマンドの読み取り', () => {
  test('commit を拾う', () => {
    expect(isCommit('git commit -m "x"')).toBe(true)
    expect(isCommit('command git commit -m "x"')).toBe(true)
    expect(isCommit('git -C ../wt commit --amend')).toBe(true)
    expect(isCommit('git add . && git commit -m x')).toBe(true)
    expect(isCommit('git log --oneline')).toBe(false)
    expect(isCommit('git status')).toBe(false)
  })

  test('自分での切り替えを拾う', () => {
    expect(isSwitch('git checkout -b feature/x')).toBe(true)
    expect(isSwitch('git switch main')).toBe(true)
    expect(isSwitch('gh pr checkout 38')).toBe(true)
    expect(isSwitch('git commit -m checkout')).toBe(false)
  })

  test('git を走らせるディレクトリ', () => {
    expect(dirOf('git commit -m x', '/w', '/h')).toBe('/w')
    expect(dirOf('git -C /other commit', '/w', '/h')).toBe('/other')
    expect(dirOf('git -C "../a b" commit', '/w', '/h')).toBe('/w/../a b')
    expect(dirOf('cd ~/repo && git commit', '/w', '/h')).toBe('/h/repo')
    expect(dirOf('cd sub; git commit', '/w', '/h')).toBe('/w/sub')
    expect(dirOf('cd ~/repo && git commit', '/w', undefined)).toBe('/w')
  })
})

describe('表示', () => {
  test('rev-parse のルートと symbolic-ref のブランチを読む', () => {
    expect(parseRepo('/w/repo\n', { exitCode: 0, stdout: 'main\n' })).toEqual({ root: '/w/repo', branch: 'main' })
    // detached HEAD では symbolic-ref が出力なしの 1 で終わる
    expect(parseRepo('/w/repo\n', { exitCode: 1, stdout: '' })).toEqual({ root: '/w/repo', branch: 'HEAD' })
    // それ以外の失敗は分からないとする（detached と取り違えて commit を止めない）
    expect(parseRepo('/w/repo\n', { exitCode: 128, stdout: '' })).toBeUndefined()
    expect(parseRepo('', { exitCode: 0, stdout: 'main\n' })).toBeUndefined()
  })

  test('基準どおりなら場所だけ、ずれたら基準も出す', () => {
    const repo = { root: '/w/repo', branch: 'main' }
    expect(statusText(repo, 'main')).toBe('⎇ repo / main')
    expect(statusText(repo, 'dev')).toBe('⚠ ⎇ repo / main（このセッションは dev）')
    expect(statusText(repo, 'main', 2)).toBe('⎇ repo / main 👥 +2')
    expect(denyText(repo, 'dev')).toContain('git checkout dev')
  })

  test('画面がないときにモデルへ添える文は、ずれと戻し方と続け方を伝える', () => {
    const repo = { root: '/w/repo', branch: 'main' }
    const note = driftNote(repo, 'dev')

    expect(keyOf(repo)).toBe('/w/repo@main')
    expect(note).toContain('/w/repo のブランチが、このセッションの基準 dev から main に変わっています')
    expect(note).toContain('git checkout dev')
    expect(note).toContain('/branch-watch accept')
  })
})
