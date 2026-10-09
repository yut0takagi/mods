import type { Register } from 'claude-code'

import { durationText } from './time'

export const register: Register = (on, options) => {
  const minMs = (typeof options.minSeconds === 'number' ? options.minSeconds : 60) * 1_000
  const hasSound = options.sound !== false

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    // 自分で中断したターンと、サブエージェントのターンは知らせない
    if (e.agentId !== undefined || e.reason === 'aborted' || e.durationMs < minMs) {
      return done
    }

    const took = durationText(e.durationMs)
    $.ui.toast(e.reason === 'answer' ? `完了しました（${took}）` : `途中で止まりました（${took}）`, { timeoutMs: 10_000 })

    if (hasSound) {
      void $.audio.play({ asset: 'sounds/done.wav' }).catch(() => undefined)
    }

    return done
  })

  on('classic.Notification', async ($, e, next) => {
    if (hasSound && e.notification_type === 'permission_prompt') {
      void $.audio.play({ asset: 'sounds/ask.wav' }).catch(() => undefined)
    }

    return next(e)
  })
}
