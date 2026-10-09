import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { APPROVAL_MS, approvedText, denyText, entriesOf, gatedBy, rejectedText } from './gate'

const pending = atom({ plugin: 'push-gate', key: 'pending' } as const, null)
const approved = atom({ plugin: 'push-gate', key: 'approved' } as const, null)

/** プロンプトは、今の処理が終わってから積む。コマンドの中から積むと、そのコマンドの終わりを待つことになるため。 */
function submitLater($: EngineInterface, text: string) {
  $.clock.after(1, () => void $.prompt.submit({ text }))
}

/** 承認を待っているコマンドを承認し、同じコマンドの実行を頼むプロンプトを積む。 */
async function approve($: EngineInterface): Promise<string | undefined> {
  const waiting = await read($, pending)

  if (waiting === null) {
    return undefined
  }

  const at = await $.clock.now()
  await update($, approved, () => ({ command: waiting.command, at }))
  await update($, pending, () => null)
  submitLater($, approvedText(waiting.command))

  return waiting.command
}

/** 承認を待っているコマンドを却下し、実行しないよう伝える。 */
async function reject($: EngineInterface): Promise<string | undefined> {
  const waiting = await read($, pending)

  if (waiting === null) {
    return undefined
  }

  await update($, pending, () => null)
  submitLater($, rejectedText(waiting.command))

  return waiting.command
}

export const register: Register = (on, options) => {
  const entries = entriesOf(typeof options.commands === 'string' ? options.commands : 'git push, gh pr merge')

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'push-gate',
      description: '承認を待っているコマンドを見る。approve で承認、reject で却下',
      argumentHint: '[approve|reject]',
    })

    return next(e)
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const command = e.command.trim()
    const entry = gatedBy(command, entries)

    if (entry === undefined) {
      return next(e)
    }

    const grant = await read($, approved)

    if (grant !== null && grant.command === command && (await $.clock.now()) - grant.at < APPROVAL_MS) {
      await update($, approved, () => null)

      return next(e)
    }

    await update($, pending, () => ({ command, entry }))
    $.ui.toast(`push-gate: ${entry} の承認を待っています`, { timeoutMs: 10_000 })

    // 画面がないとボタンもトーストも出ない。分からないときは、ボタンとコマンドの両方を案内する
    const surfaces = await $.session.surfaces().catch(() => undefined)

    return { deny: denyText(entry, surfaces === undefined || surfaces.length > 0) }
  })

  on('command.run', { command: 'push-gate' }, async ($, e) => {
    const action = e.args.trim()

    if (action === 'approve' || action === 'reject') {
      // 承認と却下は、人が入力したときだけ受け付ける（モデルやほかのプラグインからは通さない）
      if (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge') {
        return { text: 'push-gate: 承認と却下は、人が入力したときだけ受け付けます。' }
      }

      const command = action === 'approve' ? await approve($) : await reject($)

      return { text: command === undefined ? '承認を待っているコマンドはありません。' : `${action === 'approve' ? '承認' : '却下'}しました: ${command}` }
    }

    const waiting = await read($, pending)

    return { text: waiting === null ? '承認を待っているコマンドはありません。' : `承認待ち: ${waiting.command}` }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const waiting = await read($, pending)

    if (waiting === null || e.props.hasSurvey) {
      return next(e)
    }

    const { Box, Button, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Text bold>⏸ push-gate: 承認待ち（{waiting.entry}）</Text>
        <Text dimColor wrap="truncate-end">
          {waiting.command}
        </Text>
        <Box gap={1}>
          <Button key="approve" label="承認" variant="primary" hotkey="y" onPress={() => approve($)} />
          <Button key="reject" label="却下" hotkey="n" onPress={() => reject($)} />
        </Box>
      </Box>
    )
  })
}
