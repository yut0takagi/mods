import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { KEEP, outcomeOf, promptOf, replyOf, USAGE_TEXT } from './fork'
import type { Outcome } from './fork'

const PANE = 'side-question'
const entries = atom({ plugin: 'side-question', key: 'entries' } as const, [])

/** 会話の続きとして 1 問だけ聞き、答えをペインに出す。答えは会話には足さない。答えか理由を返す（空の質問なら undefined）。 */
async function ask($: EngineInterface, question: string): Promise<Outcome | undefined> {
  const text = question.trim()

  if (text === '') {
    return undefined
  }

  const id = await $.clock.now()
  await update($, entries, list => [{ id, question: text }, ...list].slice(0, KEEP))

  const result = await $.model.fork({ prompt: promptOf(text) })
  const outcome = outcomeOf(result)
  await update($, entries, list => list.map(entry => (entry.id === id ? { ...entry, ...outcome } : entry)))

  return outcome
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    // 画面がない（VS Code の拡張機能など）と、答えは返答に出て会話に残る。説明もそれに合わせる
    const isShown = (await $.session.surfaces().catch(() => undefined))?.length !== 0
    await $.command.register({
      name: 'btw',
      description: isShown
        ? '作業を止めずに脇道の質問をする。答えはペインに出て、会話には残らない'
        : '作業を止めずに脇道の質問をする。答えは返答に出て、会話に残る',
      argumentHint: '[質問]',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'btw' }, async ($, e) => {
    const question = e.args.trim()

    // 画面がないセッション（VS Code・Cursor の拡張機能、-p）では、ペインが描かれない
    // （ui.open は isPlaced: true を返すので、それでは見分けられない）。答えを待って返答の文で返す。
    // 返答の文はモデルも読む行として会話に残る。人にだけ見せる道（ui.log、session.append の system）は
    // 拡張機能では描かれないので使えない（2.1.289 の webview は ui_log を扱わず、プラグインの notice が
    // なる level: info の informational 行も描かない。コードを読んだ結果で、実機では確かめていない）
    if ((await $.session.surfaces()).length === 0) {
      const outcome = await ask($, question)

      return { text: outcome === undefined ? USAGE_TEXT : replyOf(question, outcome) }
    }

    await $.ui.open({ id: PANE, title: 'BTW', ...(question === '' && { focus: true as const }) })

    if (question !== '') {
      await ask($, question)
    }

    // 会話に何も残さないよう、出力の文は返さない
    return {}
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Markdown, Text } = table
    const list = await read($, entries)

    return (
      <Box flexDirection="column">
        {'Input' in table && (
          <table.Input key="ask" placeholder="脇道の質問を入力して Enter" submitLabel="聞く" value="" autoFocus onSubmit={value => ask($, value)} />
        )}
        {list.length === 0 && <Text dimColor>答えはここに出ます。会話には残りません。</Text>}
        {list.map(entry => (
          <Box key={`q-${entry.id}`} flexDirection="column" marginTop={1}>
            <Text bold>Q. {entry.question}</Text>
            {entry.answer !== undefined && <Markdown text={entry.answer} />}
            {entry.error !== undefined && <Text color="red">{entry.error}</Text>}
            {entry.answer === undefined && entry.error === undefined && <Text dimColor>考え中…</Text>}
            {entry.cacheRate !== undefined && (
              <Text dimColor>キャッシュから読んだ入力 {Math.round(entry.cacheRate * 100)}%</Text>
            )}
          </Box>
        ))}
      </Box>
    )
  })
}
