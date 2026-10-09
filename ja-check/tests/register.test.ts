import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

function worldOf(on: On) {
  const world = { toasts: [] as string[], submitted: [] as string[] }

  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('prompt.submit', ($, e) => {
    world.submitted.push(e.text)

    return { text: e.text }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return world
}

const answer = (text: string, more: object = {}) =>
  ({ answer: text, reason: 'answer', durationMs: 1, isAborted: false, turnId: 't', ...more }) as never

test('英語で書き出したらトーストで知らせる', async ($, on) => {
  const world = worldOf(on)
  await $.turn.complete(answer('All tests pass now.'))
  await $.turn.complete(answer('テストは通りました。'))

  expect(world.toasts).toEqual(['ja-check: 返答が英語で書き出されています'])
})

test('サブエージェントと中断は見ない', async ($, on) => {
  const world = worldOf(on)
  await $.turn.complete(answer('All tests pass now.', { agentId: 'a1' }))
  await $.turn.complete(answer('All tests pass now.', { reason: 'aborted', isAborted: true }))

  expect(world.toasts).toEqual([])
})

test('rewrite なら一度だけ書き直しを頼み、続けて英語なら知らせるだけにする', { options: { mode: 'rewrite' } }, async ($, on) => {
  const world = worldOf(on)
  await $.turn.complete(answer('All tests pass now.'))
  await $.turn.complete(answer('Still in English, sorry.'))

  expect(world.submitted).toHaveLength(1)
  expect(world.toasts).toEqual(['ja-check: 返答が英語で書き出されています'])
})
