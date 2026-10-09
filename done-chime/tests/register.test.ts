import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { durationText } from '../hooks/time'

function worldOf(on: On) {
  const world = { toasts: [] as string[], played: [] as string[] }

  on('ui.toast', ($, e) => {
    world.toasts.push(e.text)

    return { value: undefined }
  })
  on('audio.play', ($, e) => {
    world.played.push(e.clip.asset ?? '?')

    return { value: undefined }
  })
  on('turn.complete', ($, e) => ({ text: e.answer }))

  return world
}

const turn = (durationMs: number, more: object = {}) =>
  ({ answer: '完了', reason: 'answer', durationMs, isAborted: false, turnId: 't', ...more }) as never

test('かかった時間の書き方', () => {
  expect(durationText(42_000)).toBe('42秒')
  expect(durationText(133_000)).toBe('2分13秒')
})

test('長いターンが終わったら音とトーストで知らせる', async ($, on) => {
  const world = worldOf(on)
  await $.turn.complete(turn(133_000))

  expect(world.toasts).toEqual(['完了しました（2分13秒）'])
  expect(world.played).toEqual(['sounds/done.wav'])
})

test('短いターン・中断・サブエージェントでは知らせない', async ($, on) => {
  const world = worldOf(on)
  await $.turn.complete(turn(5_000))
  await $.turn.complete(turn(200_000, { reason: 'aborted', isAborted: true }))
  await $.turn.complete(turn(200_000, { agentId: 'a1' }))

  expect(world.toasts).toEqual([])
  expect(world.played).toEqual([])
})

test('音をオフにするとトーストだけ', { options: { sound: false } }, async ($, on) => {
  const world = worldOf(on)
  await $.turn.complete(turn(90_000))

  expect(world.toasts).toEqual(['完了しました（1分30秒）'])
  expect(world.played).toEqual([])
})

test('許可を待つときは別の音を鳴らす', async ($, on) => {
  const world = worldOf(on)
  on('classic.Notification', () => ({}) as never)
  await $.classic.Notification({ message: 'Claude needs your permission', notification_type: 'permission_prompt' } as never)

  expect(world.played).toEqual(['sounds/ask.wav'])
})
