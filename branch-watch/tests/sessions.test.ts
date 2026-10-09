import { describe, expect, test } from 'claude-code/testing'

import type { Peer } from '../types'
import { countIn, groupsOf, isLive, labelOf, listText, parsePeer } from '../hooks/sessions'

const peer = (id: string, more: Partial<Peer> = {}): Peer => ({ id, label: '', dir: '/h', isWorking: false, updatedAt: 0, ...more })

describe('名札', () => {
  test('空白をまとめ、タグの塊を除き、長ければ切る', () => {
    expect(labelOf('  README の\n誤字を  直して ')).toBe('README の 誤字を 直して')
    expect(labelOf('<ide_selection>const a = 1</ide_selection>これを直して')).toBe('これを直して')
    expect(labelOf('あ'.repeat(40))).toBe(`${'あ'.repeat(32)}…`)
    expect(labelOf('')).toBe('')
  })
})

describe('共有のファイル', () => {
  test('形が合えば読み、壊れていれば捨てる', () => {
    expect(parsePeer(JSON.stringify(peer('a', { root: '/w/repo', branch: 'main' })))).toEqual(
      peer('a', { root: '/w/repo', branch: 'main' }),
    )
    expect(parsePeer('{"id":"a","dir":"/h","updat')).toBeUndefined()
    expect(parsePeer('{"id":"a"}')).toBeUndefined()
  })

  test('60 秒書かれていなければ止まったとみなす', () => {
    expect(isLive(peer('a', { updatedAt: 1_000 }), 60_999)).toBe(true)
    expect(isLive(peer('a', { updatedAt: 1_000 }), 61_000)).toBe(false)
  })

  test('同じ worktree のセッションを数える', () => {
    expect(countIn([peer('a', { root: '/w/a' }), peer('b', { root: '/w/b' }), peer('c', { root: '/w/a' })], '/w/a')).toBe(2)
  })
})

describe('並べ方', () => {
  const list = [
    peer('zz', { root: '/w/b', branch: 'main' }),
    peer('me', { root: '/w/c', branch: 'old', updatedAt: 1 }),
    peer('aa', { root: '/w/c', branch: 'new', updatedAt: 2 }),
    peer('xx', { dir: '/h/notes' }),
    peer('yy', { root: '/w/a', branch: 'dev' }),
  ]

  test('自分のいる worktree が先頭、git の外は最後。組の中は自分が先頭', () => {
    const groups = groupsOf(list, 'me')

    expect(groups.map(group => group.root)).toEqual(['/w/c', '/w/a', '/w/b', undefined])
    expect(groups[0]?.peers.map(one => one.id)).toEqual(['me', 'aa'])
  })

  test('組のブランチは、いちばん新しく書かれたセッションから見えたもの', () => {
    expect(groupsOf(list, 'me')[0]?.branch).toBe('new')
  })

  test('返答に出す一覧', () => {
    const text = listText(groupsOf([peer('me', { root: '/w/c', branch: 'x', baseline: 'y', isWorking: true, label: '直して' }), peer('xx', { dir: '/h/notes' })], 'me'), 'me')

    expect(text).toBe(['⎇ c / x  /w/c', '  ● 作業中 このセッション 直して ⚠ 基準は y', 'git の外', '  ○ 待機中 xx /h/notes'].join('\n'))
  })
})
