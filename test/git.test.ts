import test from 'node:test'
import assert from 'node:assert/strict'

import * as git from '../src/git.js'

const MOCK_COMMIT_LOG = `
abc1234|abc|2024-03-20T10:00:00Z|Alice Chen|alice@co.com|feat: add auth|def5678
def5678|def|2024-03-19T09:00:00Z|Bob Smith|bob@co.com|fix: null check|ghi9012 jkl3456
ghi9012|ghi|2024-03-18T08:00:00Z|Alice Chen|alice@co.com|chore: cleanup|
jkl3456|jkl|2024-03-17T07:00:00Z|Bob Smith|bob@co.com|Initial commit|
`.trim()

const MOCK_NUMSTAT = `
abc1234
10\t2\tsrc/auth.ts
5\t1\tsrc/api.ts

def5678
3\t0\tsrc/auth.ts
20\t5\tsrc/utils.ts
`.trim()

const MIXED_CASE_ACTIVITY = `
2024-03-20T10:00:00Z|ALICE@CO.COM
2024-03-18T08:00:00Z|alice@co.com
2024-03-19T09:00:00Z|Bob@Co.Com
2024-03-17T07:00:00Z|bob@co.com
`.trim()

function buildCommitMap(commits: git.CommitData[]): Map<string, git.CommitData> {
  return new Map(commits.map((commit) => [commit.hash, commit]))
}

test('parseCommitLog parses 4 commits correctly', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  assert.equal(commits.length, 4)
  assert.equal(commits[0].hash, 'abc1234')
  assert.equal(commits[3].shortHash, 'jkl')
})

test('parseCommitLog handles multiple parents for merge commits', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  assert.deepEqual(commits[1].parents, ['ghi9012', 'jkl3456'])
})

test('parseCommitLog handles empty parents for initial commit', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  assert.deepEqual(commits[2].parents, [])
  assert.deepEqual(commits[3].parents, [])
})

test('parseCommitLog preserves special chars in subject line', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00Z|Alice|alice@co.com|fix(scope): parse x|y correctly|')
  assert.equal(commits[0].subject, 'fix(scope): parse x|y correctly')
})

test('parseCommitLog preserves emoji in subject line', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00Z|Alice|alice@co.com|feat: add auth 🔐|')
  assert.equal(commits[0].subject, 'feat: add auth 🔐')
})

test('parseCommitLog returns empty array for empty input', () => {
  assert.deepEqual(git.parseCommitLog(''), [])
})

test('parseCommitLog normalizes utc dates', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00Z|Alice|alice@co.com|feat|')
  assert.equal(commits[0].date, '2024-03-20T10:00:00.000Z')
})

test('parseCommitLog normalizes dates without timezone', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00|Alice|alice@co.com|feat|')
  assert.equal(commits[0].date, '2024-03-20T10:00:00.000Z')
})

test('parseCommitLog normalizes dates with positive offset', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00+02:00|Alice|alice@co.com|feat|')
  assert.equal(commits[0].date, '2024-03-20T08:00:00.000Z')
})

test('parseCommitLog normalizes email casing', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00Z|Alice|ALICE@CO.COM|feat|')
  assert.equal(commits[0].email, 'alice@co.com')
})

test('parseContributorActivity groups unique active days by normalized email', () => {
  const activity = git.parseContributorActivity(MIXED_CASE_ACTIVITY)
  assert.equal(activity.get('alice@co.com')?.size, 2)
  assert.equal(activity.get('bob@co.com')?.size, 2)
})

test('parseContributorActivity ignores empty lines', () => {
  const activity = git.parseContributorActivity('\n2024-03-20T10:00:00Z|alice@co.com\n\n')
  assert.equal(activity.size, 1)
})

test('parseNumstat parses numstat correctly', () => {
  const numstat = git.parseNumstat(MOCK_NUMSTAT)
  assert.equal(numstat.length, 4)
  assert.deepEqual(numstat[0], {
    commit: 'abc1234',
    insertions: 10,
    deletions: 2,
    file: 'src/auth.ts'
  })
})

test('parseNumstat handles binary files as zero insertions/deletions', () => {
  const numstat = git.parseNumstat('abc1234\n-\t-\tassets/logo.png')
  assert.deepEqual(numstat[0], {
    commit: 'abc1234',
    insertions: 0,
    deletions: 0,
    file: 'assets/logo.png'
  })
})

test('parseNumstat handles rename paths', () => {
  const numstat = git.parseNumstat('abc1234\n1\t1\tsrc/{old => new}/file.ts')
  assert.equal(numstat[0].file, 'src/{old => new}/file.ts')
})

test('parseNumstat ignores blank lines between commits', () => {
  const numstat = git.parseNumstat('abc1234\n1\t1\ta.ts\n\n\ndef5678\n2\t0\tb.ts')
  assert.equal(numstat.length, 2)
})

test('parseContributors groups Alice commits correctly', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const contributors = git.parseContributors(commits, git.parseContributorActivity(MIXED_CASE_ACTIVITY), git.parseNumstat(MOCK_NUMSTAT))
  assert.equal(contributors[0].author, 'Alice Chen')
  assert.equal(contributors[0].commitCount, 2)
})

test('parseContributors calculates Bob commit count', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const contributors = git.parseContributors(commits, git.parseContributorActivity(MIXED_CASE_ACTIVITY), git.parseNumstat(MOCK_NUMSTAT))
  const bob = contributors.find((contributor) => contributor.email === 'bob@co.com')
  assert.equal(bob?.commitCount, 2)
})

test('parseContributors firstCommit and lastCommit dates are correct', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const contributors = git.parseContributors(commits, git.parseContributorActivity(MIXED_CASE_ACTIVITY), git.parseNumstat(MOCK_NUMSTAT))
  const alice = contributors.find((contributor) => contributor.email === 'alice@co.com')
  assert.equal(alice?.firstCommit, '2024-03-18T08:00:00.000Z')
  assert.equal(alice?.lastCommit, '2024-03-20T10:00:00.000Z')
})

test('parseContributors activeDays are calculated correctly', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const contributors = git.parseContributors(commits, git.parseContributorActivity(MIXED_CASE_ACTIVITY), git.parseNumstat(MOCK_NUMSTAT))
  const bob = contributors.find((contributor) => contributor.email === 'bob@co.com')
  assert.equal(bob?.activeDays, 2)
})

test('parseContributors handles a single contributor', () => {
  const commits = git.parseCommitLog('abc1234|abc|2024-03-20T10:00:00Z|Alice|alice@co.com|feat|')
  const activity = git.parseContributorActivity('2024-03-20T10:00:00Z|alice@co.com')
  const numstat = git.parseNumstat('abc1234\n2\t1\tsrc/index.ts')
  const contributors = git.parseContributors(commits, activity, numstat)
  assert.equal(contributors.length, 1)
  assert.equal(contributors[0].insertions, 2)
})

test('parseContributors handles empty input', () => {
  assert.deepEqual(git.parseContributors([], new Map(), []), [])
})

test('parseContributors groups emails case-insensitively', () => {
  const commits = git.parseCommitLog(`
abc1234|abc|2024-03-20T10:00:00Z|Alice|ALICE@CO.COM|feat|
def5678|def|2024-03-21T10:00:00Z|Alice|alice@co.com|fix|
`.trim())
  const activity = git.parseContributorActivity(`
2024-03-20T10:00:00Z|alice@co.com
2024-03-21T10:00:00Z|ALICE@CO.COM
`.trim())
  const contributors = git.parseContributors(commits, activity, [])
  assert.equal(contributors.length, 1)
  assert.equal(contributors[0].commitCount, 2)
})

test('parseContributors ignores numstat entries for unknown commits', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const contributors = git.parseContributors(
    commits,
    git.parseContributorActivity(MIXED_CASE_ACTIVITY),
    [...git.parseNumstat(MOCK_NUMSTAT), { commit: 'missing', insertions: 99, deletions: 99, file: 'ghost.ts' }]
  )
  assert.equal(contributors[0].insertions, 15)
})

test('parseFileChurn parses and aggregates numstat output', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const churn = git.parseFileChurn(MOCK_NUMSTAT, buildCommitMap(commits))
  assert.equal(churn.length, 3)
  assert.equal(churn[0].file, 'src/auth.ts')
  assert.equal(churn[0].changeCount, 2)
  assert.equal(churn[0].insertions, 13)
  assert.equal(churn[0].deletions, 2)
})

test('parseFileChurn sorts by change count descending', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const churn = git.parseFileChurn(MOCK_NUMSTAT, buildCommitMap(commits))
  assert.deepEqual(churn.map((entry) => entry.file), ['src/auth.ts', 'src/utils.ts', 'src/api.ts'])
})

test('parseFileChurn handles binary files', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const churn = git.parseFileChurn('abc1234\n-\t-\tassets/logo.png', buildCommitMap(commits))
  assert.equal(churn[0].insertions, 0)
  assert.equal(churn[0].deletions, 0)
})

test('parseFileChurn handles renames', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const churn = git.parseFileChurn('abc1234\n4\t2\tsrc/{old => new}/file.ts', buildCommitMap(commits))
  assert.equal(churn[0].file, 'src/{old => new}/file.ts')
})

test('parseFileChurn authors list contains all editors of a file', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const churn = git.parseFileChurn(MOCK_NUMSTAT, buildCommitMap(commits))
  assert.deepEqual(churn[0].authors.sort(), ['Alice Chen', 'Bob Smith'])
})

test('parseFileChurn respects limit', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  const churn = git.parseFileChurn(MOCK_NUMSTAT, buildCommitMap(commits), 2)
  assert.equal(churn.length, 2)
})

test('parseFileChurn returns empty array for empty input', () => {
  const commits = git.parseCommitLog(MOCK_COMMIT_LOG)
  assert.deepEqual(git.parseFileChurn('', buildCommitMap(commits)), [])
})

test('getCommitGraph uses mocked git commands and assigns branches', async () => {
  git.setGitRunner((_repoPath, args) => {
    const command = args.join(' ')
    if (command.includes('log --format=%H|%h|%aI|%an|%ae|%s|%P --all')) {
      return MOCK_COMMIT_LOG
    }
    if (command.includes('branch --format=%(refname:short)')) {
      return 'main\nfeature'
    }
    if (command.includes('rev-list main')) {
      return 'abc1234\ndef5678\nghi9012\njkl3456'
    }
    if (command.includes('rev-list feature')) {
      return 'abc1234'
    }
    return ''
  })

  const commits = await git.getCommitGraph('/tmp/example')

  assert.equal(commits[0].branch, 'main')
  assert.equal(commits.length, 4)
  git.resetGitRunner()
})
