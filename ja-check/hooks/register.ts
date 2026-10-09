import type { Register } from 'claude-code'

import { openingOf } from './lang'

const REWRITE = '直前の返答が英語で書き出されていました。同じ内容を日本語で書き直してください。'

export const register: Register = (on, options) => {
  const mode = options.mode === 'rewrite' ? 'rewrite' : 'toast'
  // 書き直しを頼んだ直後の返答も英語なら、もう頼まずに知らせるだけにする（頼み続けて回らないように）
  let hasAskedRewrite = false

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    if (e.agentId !== undefined || e.reason !== 'answer') {
      return done
    }

    const canAskRewrite = mode === 'rewrite' && !hasAskedRewrite
    hasAskedRewrite = false

    if (openingOf(e.answer) !== 'en') {
      return done
    }

    if (canAskRewrite) {
      hasAskedRewrite = true
      // 待つとこのターンの終わりを待つことになるので、積むだけにする
      void $.prompt.submit({ text: REWRITE })
    } else {
      $.ui.toast('ja-check: 返答が英語で書き出されています', { timeoutMs: 8_000 })
    }

    return done
  })
}
