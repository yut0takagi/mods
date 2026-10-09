import { describe, expect, test } from 'claude-code/testing'

import { openingOf } from '../hooks/lang'

describe('書き出しの言語', () => {
  test('日本語', () => {
    expect(openingOf('テストを直しました。')).toBe('ja')
    expect(openingOf('[register.ts](hooks/register.ts) を直しました')).toBe('ja')
    expect(openingOf('`git status` は clean です')).toBe('ja')
  })

  test('英語', () => {
    expect(openingOf('All tests pass now.')).toBe('en')
    expect(openingOf('- Fixed the failing test in the parser')).toBe('en')
    expect(openingOf('Here is a summary of the changes.\n\n本文')).toBe('en')
  })

  test('見出し・表・コードブロックは飛ばす', () => {
    expect(openingOf('## Summary\n\n変更は 3 点です。')).toBe('ja')
    expect(openingOf('| a | b |\n|---|---|\n\n結果は上のとおりです')).toBe('ja')
    expect(openingOf('```ts\nconst answer = will be ignored here\n```\n日本語の説明')).toBe('ja')
  })

  test('短い行だけでは決めない', () => {
    expect(openingOf('OK')).toBe('unknown')
    expect(openingOf('/Users/me/repo\nPR #38\n完了')).toBe('ja')
    expect(openingOf('')).toBe('unknown')
  })
})
