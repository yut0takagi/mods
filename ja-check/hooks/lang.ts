/** 返答の書き出しが日本語かどうか。$ に触れない部分。 */

export type Opening = 'ja' | 'en' | 'unknown'

const JA = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u
const WORD = /[A-Za-z]{2,}/g
const FENCE = /^\s*(```|~~~)/

// 英語と決めるのに要る英単語の数。`OK` やパスだけの行では決めない
const MIN_WORDS = 3
// 言語の決まらない行をいくつまで読み進めるか
const MAX_LINES = 3

/** 行から Markdown の記号・インラインコード・URL・パスを除いた地の文。見出しと表の行は空にする。 */
function proseOf(line: string): string {
  const text = line.trim()

  if (text.startsWith('#') || text.startsWith('|')) {
    return ''
  }

  return text
    .replace(/`[^`]*`/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\S*\/\S*/g, ' ')
    .replace(/^(?:[>*+-]|\d+\.)\s+/, '')
    .trim()
}

/** 書き出しの言語。コードブロック・見出し・表を飛ばし、言語の決まる最初の行で決める。 */
export function openingOf(answer: string): Opening {
  let isInFence = false
  let undecided = 0

  for (const line of answer.split('\n')) {
    if (FENCE.test(line)) {
      isInFence = !isInFence
      continue
    }

    const prose = isInFence ? '' : proseOf(line)

    if (prose === '') {
      continue
    }

    if (JA.test(prose)) {
      return 'ja'
    }

    if ((prose.match(WORD) ?? []).length >= MIN_WORDS) {
      return 'en'
    }

    undecided += 1

    if (undecided >= MAX_LINES) {
      break
    }
  }

  return 'unknown'
}
