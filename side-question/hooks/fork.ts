/** 脇道の質問の組み立てと、fork の結果の読み方。$ に触れない部分。 */

import type { ModelForkResult } from 'claude-code'

import type { Entry } from '../types'

// 質問の言語で答えてもらうため、前置きは英語にしておく
const PREFIX = 'This is a side question, separate from the current task. Do not continue the task; answer only this question, briefly.'

export const promptOf = (question: string) => `${PREFIX}\n\n${question}`

/** ペインに残す数。古いものから消す。 */
export const KEEP = 10

/** Markdown に渡せる長さ。 */
const MAX_TEXT = 10_000

/** 1 問の結末。答えか、答えられなかった理由のどちらか。 */
export type Outcome = Pick<Entry, 'answer' | 'error' | 'cacheRate'>

/** fork の結果を、ペインに出す答えか理由にする。 */
export function outcomeOf(result: ModelForkResult): Outcome {
  if (result.isAnswered) {
    const { input_tokens, cache_read_input_tokens, cache_creation_input_tokens } = result.usage
    const total = input_tokens + cache_read_input_tokens + cache_creation_input_tokens

    return {
      answer: result.text.slice(0, MAX_TEXT),
      ...(total > 0 && { cacheRate: cache_read_input_tokens / total }),
    }
  }

  switch (result.reason) {
    case 'nothing-to-fork':
      return { error: 'まだ会話がありません。最初の返答のあとで聞けます。' }
    case 'api-error':
      return { error: `API エラーで答えられませんでした（${result.status ?? '?'}）。` }
    case 'empty-reply':
      return { error: '答えが空でした。' }
    default:
      return { error: '中断されました。' }
  }
}

/** 画面がないセッションで /btw に質問がなかったときの返答。入力欄のあるペインが出ないので、書き方を返す。 */
export const USAGE_TEXT = '質問は /btw のあとに続けて書いてください。例: /btw なんでこの設計？'

/** 画面がないセッションで、ペインの代わりにコマンドの返答として出す文。この文は会話に残り、モデルも読む。 */
export function replyOf(question: string, outcome: Outcome): string {
  const lines = [`Q. ${question}`, '', outcome.answer ?? outcome.error ?? '']

  if (outcome.cacheRate !== undefined) {
    lines.push('', `キャッシュから読んだ入力 ${Math.round(outcome.cacheRate * 100)}%`)
  }

  lines.push('', '（画面のないセッションなのでペインの代わりにここへ出しました。この答えは会話に残ります）')

  return lines.join('\n')
}
