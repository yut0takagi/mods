import { describe, expect, test } from 'claude-code/testing'

import { entriesOf, gatedBy } from '../hooks/gate'

const ENTRIES = entriesOf('git push,  gh pr merge , ')

describe('承認が要るコマンドの見分け方', () => {
  test('設定を項目に分ける', () => {
    expect(ENTRIES).toEqual(['git push', 'gh pr merge'])
  })

  test('オプションを挟んだ形や、つないだ形も拾う', () => {
    expect(gatedBy('git push', ENTRIES)).toBe('git push')
    expect(gatedBy('git push -u origin feature/x', ENTRIES)).toBe('git push')
    expect(gatedBy('git -C ../wt push', ENTRIES)).toBe('git push')
    expect(gatedBy('git --no-pager push origin', ENTRIES)).toBe('git push')
    expect(gatedBy('git add . && git commit -m x && git push', ENTRIES)).toBe('git push')
    expect(gatedBy('command git push', ENTRIES)).toBe('git push')
    expect(gatedBy('gh pr merge 12 --squash', ENTRIES)).toBe('gh pr merge')
  })

  test('別のコマンドは通す', () => {
    expect(gatedBy('git status', ENTRIES)).toBeUndefined()
    expect(gatedBy('git log --grep push', ENTRIES)).toBeUndefined()
    expect(gatedBy('git pushx', ENTRIES)).toBeUndefined()
    expect(gatedBy('gh pr view 12', ENTRIES)).toBeUndefined()
    expect(gatedBy('legit push', ENTRIES)).toBeUndefined()
  })
})
