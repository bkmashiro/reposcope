import test from 'node:test'
import assert from 'node:assert/strict'

import * as git from '../src/git.js'

const MOCK_LOG = `abc1234|abc|2024-03-20T10:00:00Z|Alice|alice@co.com|feat: add login|def5678
def5678|def|2024-03-19T09:00:00Z|Bob|bob@co.com|fix: null check|ghi9012
ghi9012|ghi|2024-03-18T08:00:00Z|Alice|alice@co.com|Initial commit|`

const MOCK_ACTIVITY = `2024-03-20T10:00:00Z|alice@co.com
2024-03-18T08:00:00Z|alice@co.com
2024-03-19T09:00:00Z|bob@co.com`

const MOCK_NUMSTAT = `abc1234
12\t1\tsrc/auth.ts
4\t0\tREADME.md
def5678
1\t2\tsrc/auth.ts
ghi9012
20\t0\tsrc/index.ts`

test('parseCommitLog returns commit data with parents', () => {
  const commits = git.parseCommitLog(MOCK_LOG)
  assert.equal(commits.length, 3)
  assert.equal(commits[0].hash, 'abc1234')
  assert.deepEqual(commits[0].parents, ['def5678'])
  assert.deepEqual(commits[2].parents, [])
})

test('parseContributors groups by email and computes date ranges', () => {
  const commits = git.parseCommitLog(MOCK_LOG)
  const activity = git.parseContributorActivity(MOCK_ACTIVITY)
  const numstat = git.parseNumstat(MOCK_NUMSTAT)
  const contributors = git.parseContributors(commits, activity, numstat)

  assert.equal(contributors.length, 2)
  assert.equal(contributors[0].email, 'alice@co.com')
  assert.equal(contributors[0].commitCount, 2)
  assert.equal(contributors[0].insertions, 36)
  assert.equal(contributors[0].deletions, 1)
  assert.equal(contributors[0].firstCommit, '2024-03-18T08:00:00Z')
  assert.equal(contributors[0].lastCommit, '2024-03-20T10:00:00Z')
  assert.equal(contributors[0].activeDays, 2)
})

test('parseFileChurn parses numstat output correctly', () => {
  const commits = git.parseCommitLog(MOCK_LOG)
  const commitMap = new Map(commits.map((commit) => [commit.hash, commit]))
  const churn = git.parseFileChurn(MOCK_NUMSTAT, commitMap)

  assert.equal(churn[0].file, 'src/auth.ts')
  assert.equal(churn[0].changeCount, 2)
  assert.equal(churn[0].insertions, 13)
  assert.equal(churn[0].deletions, 3)
  assert.deepEqual(churn[0].authors.sort(), ['Alice', 'Bob'])
})

test('getCommitGraph uses mocked git commands', async () => {
  git.setGitRunner((_repoPath, args) => {
    const command = args.join(' ')
    if (command.includes('log --format=%H|%h|%aI|%an|%ae|%s|%P --all')) {
      return MOCK_LOG
    }
    if (command.includes('branch --format=%(refname:short)')) {
      return 'main\nfeature'
    }
    if (command.includes('rev-list main')) {
      return 'abc1234\ndef5678\nghi9012'
    }
    if (command.includes('rev-list feature')) {
      return 'abc1234'
    }
    return ''
  })

  const commits = await git.getCommitGraph('/tmp/example')

  assert.equal(commits[0].branch, 'main')
  assert.equal(commits.length, 3)
  git.resetGitRunner()
})
