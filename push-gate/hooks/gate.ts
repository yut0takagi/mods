/** 承認が要るコマンドの見分け方と、文言。$ に触れない部分。 */

// 語と語の間に挟まってよいオプション（`git -C dir push`、`git --no-pager push` など）
const OPTIONS = String.raw`(?:\s+-\S+(?:\s+\S+)?)*?`

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** 設定の文字列を項目に分ける。 */
export const entriesOf = (setting: string) =>
  setting
    .split(',')
    .map(entry => entry.trim().split(/\s+/).join(' '))
    .filter(entry => entry !== '')

/** 項目の語が順に並ぶコマンドに当たる正規表現。最初の語のあとにはオプションが挟まってよい。 */
export function patternOf(entry: string): RegExp {
  const [first = '', ...rest] = entry.split(' ').map(escape)
  const tail = rest.map(word => String.raw`\s+${word}`).join('')

  return new RegExp(String.raw`(?:^|[\s;&|(])${first}${rest.length > 0 ? OPTIONS : ''}${tail}(?=$|[\s;&|)])`)
}

/** コマンドが当たった項目。当たらなければ undefined。 */
export const gatedBy = (command: string, entries: readonly string[]) =>
  entries.find(entry => patternOf(entry).test(command))

/** 承認の有効期限。承認したまま実行されなかったコマンドを、あとで素通りさせない。 */
export const APPROVAL_MS = 10 * 60 * 1_000

/** `hasButton` が false（VS Code 拡張機能のように画面がない）なら、出ないボタンには触れずコマンドだけを案内する。 */
export const denyText = (entry: string, hasButton: boolean) =>
  [
    `push-gate: \`${entry}\` には人の承認が要るため、実行していません。`,
    hasButton
      ? 'ユーザーに承認を頼んで、このターンを終えてください（入力欄の上の「承認」ボタン、または /push-gate approve）。'
      : 'ユーザーに、入力欄で /push-gate approve と打って承認するよう頼んで、このターンを終えてください（取りやめるなら /push-gate reject）。この画面には承認ボタンが出ません。',
    '承認されると、同じコマンドの実行を頼むメッセージが届きます。',
  ].join('\n')

export const approvedText = (command: string) =>
  ['push-gate: 承認しました。次のコマンドを、書き換えずにそのまま実行してください。', '', '```sh', command, '```'].join('\n')

export const rejectedText = (command: string) =>
  ['push-gate: 却下しました。次のコマンドは実行しないでください。', '', '```sh', command, '```'].join('\n')
