import { describe, expect, test } from 'claude-code/testing'

import { causeOf, checkOf, clockOf, detailOf, parsePrs, summaryOf, textOf } from '../hooks/prs'

describe('CI のまとめ', () => {
  test('ひとつでも落ちていれば fail', () => {
    expect(checkOf([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'COMPLETED', conclusion: 'FAILURE' }])).toBe('fail')
    expect(checkOf([{ state: 'ERROR' }])).toBe('fail')
  })

  test('走っているものがあれば pending', () => {
    expect(checkOf([{ status: 'IN_PROGRESS', conclusion: '' }, { status: 'COMPLETED', conclusion: 'SUCCESS' }])).toBe('pending')
    expect(checkOf([{ state: 'PENDING' }])).toBe('pending')
  })

  test('すべて済んで落ちていなければ pass、CI がなければ none', () => {
    expect(checkOf([{ status: 'COMPLETED', conclusion: 'SUCCESS' }, { status: 'COMPLETED', conclusion: 'SKIPPED' }, { state: 'SUCCESS' }])).toBe('pass')
    expect(checkOf([])).toBe('none')
    expect(checkOf(null)).toBe('none')
  })
})

test('gh pr list の出力を読む', () => {
  const stdout = JSON.stringify([
    {
      number: 39,
      title: 'Add a retry to the uploader',
      headRefName: 'fix/upload-retry',
      baseRefName: 'develop',
      isDraft: false,
      reviewDecision: '',
      url: 'https://github.com/o/r/pull/39',
      author: { login: 'octocat' },
      statusCheckRollup: [],
    },
  ])

  expect(parsePrs(stdout)).toEqual([
    {
      number: 39,
      title: 'Add a retry to the uploader',
      head: 'fix/upload-retry',
      base: 'develop',
      author: 'octocat',
      isDraft: false,
      review: '',
      url: 'https://github.com/o/r/pull/39',
      check: 'none',
    },
  ])
})

test('ステータス行は件数と、ある分だけの CI の内訳', () => {
  const pr = { number: 1, title: '', head: '', base: '', author: '', isDraft: false, review: '', url: '' }

  expect(summaryOf([])).toBe('PR 0')
  expect(summaryOf([{ ...pr, check: 'fail' }, { ...pr, check: 'pass' }, { ...pr, check: 'none' }])).toBe('PR 3 ✗1 ✓1')
})

test('PR の 2 行目はブランチ・作者・draft・レビューを、ある分だけ', () => {
  const pr = { number: 1, title: '', head: 'feat/a', base: 'main', author: 'octocat', isDraft: false, review: '', url: '', check: 'none' } as const

  expect(detailOf(pr)).toBe('feat/a → main · @octocat')
  expect(detailOf({ ...pr, isDraft: true, review: 'CHANGES_REQUESTED' })).toBe('feat/a → main · @octocat · draft · 修正依頼')
})

describe('gh が失敗したわけ', () => {
  test('git のリポジトリでない・remote が GitHub を向いていない', () => {
    expect(causeOf('failed to run git: fatal: not a git repository (or any of the parent directories): .git')).toBe('no-repo')
    expect(causeOf('no git remotes found')).toBe('no-repo')
    expect(
      causeOf('none of the git remotes configured for this repository point to a known GitHub host. To tell gh about a new GitHub host, please use `gh auth login`'),
    ).toBe('no-repo')
  })

  test('ログインしていない・トークンが切れている', () => {
    expect(
      causeOf('To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.'),
    ).toBe('no-auth')
    expect(causeOf('HTTP 401: Bad credentials (https://api.github.com/graphql)\nTry authenticating with:  gh auth login')).toBe('no-auth')
  })

  test('どれにも当たらなければ other', () => {
    expect(causeOf('GraphQL: Could not resolve to a Repository with the name')).toBe('other')
  })
})

describe('画面がないときの /prs の返答', () => {
  const pr = {
    number: 39,
    title: 'Add a retry to the uploader',
    head: 'fix/upload-retry',
    base: 'develop',
    author: 'octocat',
    isDraft: false,
    review: 'APPROVED',
    url: 'https://github.com/o/r/pull/39',
  }

  test('ステータス行の要約を先頭に、PR ごとに CI の結果と URL を並べる', () => {
    const text = textOf({ prs: [{ ...pr, check: 'fail' }, { ...pr, number: 40, check: 'pending', isDraft: true, review: '' }], fetchedAt: 0 }, '')

    expect(text).toBe(
      [
        `PR 2 ✗1 ○1（${clockOf(0)} 時点）`,
        '',
        '- ✗ #39 Add a retry to the uploader（CI 失敗 · fix/upload-retry → develop · @octocat · 承認済み）',
        '  https://github.com/o/r/pull/39',
        '- ○ #40 Add a retry to the uploader（CI 実行中 · fix/upload-retry → develop · @octocat · draft）',
        '  https://github.com/o/r/pull/39',
      ].join('\n'),
    )
  })

  test('宛先を設定していれば見出しに出し、PR がなければそう書く', () => {
    expect(textOf({ prs: [], fetchedAt: 0 }, 'develop')).toBe(`PR 0（宛先 develop・${clockOf(0)} 時点）\n\n開いている PR はありません。`)
  })

  test('gh が失敗したら、わけと次にすることと gh の出力を返す', () => {
    const failed = (cause: 'no-gh' | 'no-auth' | 'no-repo' | 'timeout' | undefined, error: string) =>
      textOf({ prs: [], fetchedAt: 0, error, ...(cause === undefined ? {} : { cause }) }, '')

    expect(failed('no-auth', 'To get started with GitHub CLI, please run:  gh auth login')).toBe(
      [
        `PR を取れませんでした（${clockOf(0)} 時点）`,
        'gh にログインしていません。ターミナルで gh auth login を実行してから、/prs で取り直してください。',
        '詳細: To get started with GitHub CLI, please run:  gh auth login',
      ].join('\n\n'),
    )
    expect(failed('no-gh', 'Error: spawn gh ENOENT')).toContain('gh（GitHub CLI）を起動できませんでした')
    expect(failed('no-repo', 'no git remotes found')).toContain('GitHub のリポジトリではないため')
    expect(failed('timeout', 'Error: timed out')).toContain('時間内に終わりませんでした')
    expect(failed(undefined, 'something broke')).toContain('gh pr list が失敗しました。')
  })

  test('まだ取れていなければ、待ってから打ち直すよう返す', () => {
    expect(textOf(null, '')).toContain('PR をまだ取れていません')
  })
})
