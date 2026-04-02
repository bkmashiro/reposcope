import test from 'node:test'
import assert from 'node:assert/strict'

import { computeStats, formatStats } from '../src/stats.js'
import type { RepoData } from '../src/git.js'

const DATA: RepoData = {
  repoName: 'stats-repo',
  analyzedAt: '2024-03-20T10:00:00Z',
  branches: ['main', 'dev'],
  tags: [],
  commits: [
    { hash: 'a', shortHash: 'a', date: '2024-03-17T10:00:00.000Z', author: 'Alice', email: 'alice@co.com', subject: 'init', parents: [] },
    { hash: 'b', shortHash: 'b', date: '2024-03-18T10:00:00.000Z', author: 'Bob', email: 'bob@co.com', subject: 'feat', parents: ['a'] },
    { hash: 'c', shortHash: 'c', date: '2024-03-19T10:00:00.000Z', author: 'Alice', email: 'alice@co.com', subject: 'fix', parents: ['b'] },
    { hash: 'd', shortHash: 'd', date: '2024-03-21T10:00:00.000Z', author: 'Alice', email: 'alice@co.com', subject: 'docs', parents: ['c'] }
  ],
  contributors: [
    { author: 'Alice', email: 'alice@co.com', commitCount: 3, insertions: 20, deletions: 4, firstCommit: '2024-03-17T10:00:00.000Z', lastCommit: '2024-03-21T10:00:00.000Z', activeDays: 3 },
    { author: 'Bob', email: 'bob@co.com', commitCount: 1, insertions: 3, deletions: 1, firstCommit: '2024-03-18T10:00:00.000Z', lastCommit: '2024-03-18T10:00:00.000Z', activeDays: 1 }
  ],
  fileChurn: [
    { file: 'src/auth.ts', changeCount: 3, insertions: 15, deletions: 2, authors: ['Alice', 'Bob'] },
    { file: 'README.md', changeCount: 1, insertions: 5, deletions: 0, authors: ['Alice'] }
  ],
  blameSummary: []
}

test('computeStats totalCommits is correct', () => {
  assert.equal(computeStats(DATA).totalCommits, 4)
})

test('computeStats topContributor is based on commit count', () => {
  assert.equal(computeStats(DATA).topContributor, 'Alice')
})

test('computeStats mostChangedFile comes from fileChurn', () => {
  assert.equal(computeStats(DATA).mostChangedFile, 'src/auth.ts')
})

test('computeStats avgCommitsPerDay is reasonable', () => {
  assert.equal(computeStats(DATA).avgCommitsPerDay, 0.8)
})

test('computeStats returns first and last commit dates', () => {
  const stats = computeStats(DATA)
  assert.equal(stats.firstCommitDate, '2024-03-17T10:00:00.000Z')
  assert.equal(stats.lastCommitDate, '2024-03-21T10:00:00.000Z')
})

test('commitsByDayOfWeek sums to total commits', () => {
  const stats = computeStats(DATA)
  assert.equal(stats.commitsByDayOfWeek.reduce((sum, value) => sum + value, 0), stats.totalCommits)
})

test('longestStreak counts consecutive days without gaps', () => {
  const stats = computeStats({
    ...DATA,
    commits: DATA.commits.slice(0, 3)
  })
  assert.equal(stats.longestStreak, 3)
})

test('longestStreak resets when there is a gap', () => {
  assert.equal(computeStats(DATA).longestStreak, 3)
})

test('formatStats output contains all stat names', () => {
  const output = formatStats(computeStats(DATA))
  assert.match(output, /Total Commits:/)
  assert.match(output, /Active Branches:/)
  assert.match(output, /Top Contributor:/)
  assert.match(output, /Most Changed File:/)
  assert.match(output, /Average Commits Per Day:/)
  assert.match(output, /First Commit Date:/)
  assert.match(output, /Last Commit Date:/)
  assert.match(output, /Longest Streak:/)
  assert.match(output, /Commits By Day Of Week:/)
})

test('computeStats handles single-commit repo', () => {
  const stats = computeStats({
    ...DATA,
    branches: ['main'],
    commits: [DATA.commits[0]],
    contributors: [DATA.contributors[0]],
    fileChurn: [DATA.fileChurn[0]]
  })
  assert.equal(stats.totalCommits, 1)
  assert.equal(stats.longestStreak, 1)
  assert.equal(stats.avgCommitsPerDay, 1)
})
