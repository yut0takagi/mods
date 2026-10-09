import { describe, expect, test } from 'claude-code/testing'

import { listText, parseNumstat, patchOf, patchText, pickOf, shortOf, statText } from '../hooks/diff'

describe('git の出力', () => {
  test('numstat を読む', () => {
    expect(parseNumstat('12\t3\tsrc/a.ts\n')).toEqual({ added: 12, removed: 3 })
    expect(parseNumstat('-\t-\timage.png\n')).toEqual({ added: 0, removed: 0 })
    expect(parseNumstat('')).toBeNull()
  })

  test('差分は @@ から始め、長ければ hunk の切れ目で切る', () => {
    const head = 'diff --git a/x b/x\nindex 1..2 100644\n--- a/x\n+++ b/x\n'
    expect(patchOf('/w/x', `${head}@@ -1 +1 @@\n-a\n+b\n`)).toEqual({ path: '/w/x', text: '@@ -1 +1 @@\n-a\n+b', isCut: false })

    const hunk = `@@ -1 +1 @@\n${'+x\n'.repeat(3_000)}`
    const cut = patchOf('/w/x', head + hunk + hunk)
    expect(cut.isCut).toBe(true)
    expect(cut.text.length).toBeLessThanOrEqual(10_000)
    expect(cut.text.startsWith('@@')).toBe(true)
  })
})

test('表示', () => {
  expect(shortOf('/w/src/a.ts', '/w')).toBe('src/a.ts')
  expect(shortOf('/other/a.ts', '/w')).toBe('/other/a.ts')
  expect(statText({ added: 2, removed: 1 })).toBe('+2 −1')
  expect(statText(null)).toBe('変更なし')
})

describe('画面のないセッションの返答', () => {
  test('パスを編集したファイルに引き当てる', () => {
    const list = ['/w/src/a.ts', '/w/new.ts', '/w/lib/b.ts', '/w/test/b.ts']
    expect(pickOf(list, 'src/a.ts', '/w')).toBe('/w/src/a.ts')
    expect(pickOf(list, './new.ts', '/w')).toBe('/w/new.ts')
    expect(pickOf(list, '/w/src/a.ts', '/w')).toBe('/w/src/a.ts')
    expect(pickOf(list, 'a.ts', '/w')).toBe('/w/src/a.ts')
    // 末尾が 2 つ合うものと、編集していないものは引かない
    expect(pickOf(list, 'b.ts', '/w')).toBeNull()
    expect(pickOf(list, 'README.md', '/w')).toBeNull()
    expect(pickOf(list, '  ', '/w')).toBeNull()
  })

  test('一覧', () => {
    expect(listText(['/w/src/a.ts', '/other/x.ts'], { '/w/src/a.ts': { added: 1, removed: 2 }, '/other/x.ts': null }, '/w')).toBe(
      [
        'このセッションで編集したファイル（まだ commit していない変更）: 2 件',
        '',
        '- +1 −2  `src/a.ts`',
        '- 変更なし  `/other/x.ts`',
        '',
        '差分は `/session-diff <パス>` で出します。',
      ].join('\n'),
    )
    expect(listText([], {}, '/w', 'x.ts')).toBe('このセッションで編集したファイルに `x.ts` はありません。\n\nこのセッションではまだ何も編集していません。')
  })

  test('差分は diff のコードブロックで出し、切ったら何行のうち何行かを書く', () => {
    const head = 'diff --git a/x b/x\n--- a/x\n+++ b/x\n'
    expect(patchText('/w/x', `${head}@@ -1 +1 @@\n-a\n+b\n`, { added: 1, removed: 1 }, '/w')).toBe(
      '`x` の差分（まだ commit していない変更 +1 −1）\n\n```diff\n@@ -1 +1 @@\n-a\n+b\n```',
    )
    expect(patchText('/w/x', '', null, '/w')).toBe('`x` にまだ commit していない変更はありません。')

    // Markdown の ``` を含む差分でも、囲みが途中で閉じない
    expect(patchText('/w/README.md', `${head}@@ -1 +1 @@\n-\`\`\`\n+\`\`\`\`ts\n`, { added: 1, removed: 1 }, '/w')).toBe(
      '`README.md` の差分（まだ commit していない変更 +1 −1）\n\n`````diff\n@@ -1 +1 @@\n-```\n+````ts\n`````',
    )

    const hunk = `@@ -1 +1 @@\n${'+x\n'.repeat(3_000)}`
    const cut = patchText('/w/x', head + hunk + hunk, { added: 6_000, removed: 0 }, '/w')
    expect(cut.length).toBeLessThan(10_200)
    expect(cut.endsWith('長いので先頭だけ出しています（全 6002 行のうち 3001 行）。')).toBe(true)
  })
})
