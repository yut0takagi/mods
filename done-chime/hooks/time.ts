/** かかった時間を「2分13秒」の形で。 */
export function durationText(ms: number): string {
  const seconds = Math.round(ms / 1_000)
  const minutes = Math.floor(seconds / 60)

  return minutes === 0 ? `${seconds}秒` : `${minutes}分${seconds % 60}秒`
}
