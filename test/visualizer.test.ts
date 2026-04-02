import test from 'node:test'
import assert from 'node:assert/strict'

import { generateReport } from '../src/visualizer.js'
import type { RepoData } from '../src/git.js'

const data: RepoData = {
  repoName: 'demo-repo',
  analyzedAt: '2024-03-20T10:00:00Z',
  branches: ['main'],
  tags: ['v1.0.0'],
  commits: [
    {
      hash: 'abc1234',
      shortHash: 'abc',
      date: '2024-03-20T10:00:00Z',
      author: 'Alice',
      email: 'alice@co.com',
      subject: 'feat: add login',
      parents: []
    }
  ],
  contributors: [
    {
      author: 'Alice',
      email: 'alice@co.com',
      commitCount: 1,
      insertions: 10,
      deletions: 2,
      firstCommit: '2024-03-20T10:00:00Z',
      lastCommit: '2024-03-20T10:00:00Z',
      activeDays: 1
    }
  ],
  fileChurn: [
    {
      file: 'src/index.ts',
      changeCount: 1,
      insertions: 10,
      deletions: 2,
      authors: ['Alice']
    }
  ],
  blameSummary: [
    {
      file: 'src/index.ts',
      totalLines: 12,
      authors: [{ author: 'Alice', lines: 12, percentage: 100 }]
    }
  ]
}

test('generateReport returns a self-contained HTML document', () => {
  const output = generateReport(data)
  assert.match(output, /<!DOCTYPE html>/)
  assert.match(output, /<title>reposcope — demo-repo<\/title>/)
  assert.match(output, /const DATA = /)
  assert.match(output, /"commits":\[/)
  assert.match(output, /https:\/\/cdn\.jsdelivr\.net\/npm\/d3@7/)
})
