import test from 'node:test'
import assert from 'node:assert/strict'

import { generateReport } from '../src/visualizer.js'
import type { RepoData } from '../src/git.js'

const MOCK_DATA: RepoData = {
  repoName: 'my-repo',
  analyzedAt: '2024-03-20T10:00:00Z',
  branches: ['main', 'dev', 'feature/auth'],
  tags: ['v1.0.0'],
  commits: [
    {
      hash: 'aaa1111',
      shortHash: 'aaa1111',
      date: '2024-03-16T08:00:00Z',
      author: 'Alice Chen',
      email: 'alice@co.com',
      subject: 'feat: bootstrap repo',
      parents: [],
      branch: 'main',
      files: ['README.md']
    },
    {
      hash: 'bbb2222',
      shortHash: 'bbb2222',
      date: '2024-03-17T08:00:00Z',
      author: 'Bob Smith',
      email: 'bob@co.com',
      subject: 'fix: null guard',
      parents: ['aaa1111'],
      branch: 'main',
      files: ['src/auth.ts']
    },
    {
      hash: 'ccc3333',
      shortHash: 'ccc3333',
      date: '2024-03-18T08:00:00Z',
      author: 'Alice Chen',
      email: 'alice@co.com',
      subject: 'feat: add auth flow',
      parents: ['bbb2222'],
      branch: 'feature/auth',
      files: ['src/auth.ts', 'src/api.ts']
    },
    {
      hash: 'ddd4444',
      shortHash: 'ddd4444',
      date: '2024-03-19T08:00:00Z',
      author: 'Cara Jones',
      email: 'cara@co.com',
      subject: 'docs: explain API',
      parents: ['ccc3333'],
      branch: 'dev',
      files: ['docs/api.md']
    },
    {
      hash: 'eee5555',
      shortHash: 'eee5555',
      date: '2024-03-20T10:00:00Z',
      author: 'Bob Smith',
      email: 'bob@co.com',
      subject: 'merge: release auth',
      parents: ['ccc3333', 'ddd4444'],
      branch: 'main',
      files: ['src/auth.ts', 'src/utils.ts']
    }
  ],
  contributors: [
    {
      author: 'Alice Chen',
      email: 'alice@co.com',
      commitCount: 2,
      insertions: 30,
      deletions: 4,
      firstCommit: '2024-03-16T08:00:00Z',
      lastCommit: '2024-03-18T08:00:00Z',
      activeDays: 2
    },
    {
      author: 'Bob Smith',
      email: 'bob@co.com',
      commitCount: 2,
      insertions: 19,
      deletions: 5,
      firstCommit: '2024-03-17T08:00:00Z',
      lastCommit: '2024-03-20T10:00:00Z',
      activeDays: 2
    },
    {
      author: 'Cara Jones',
      email: 'cara@co.com',
      commitCount: 1,
      insertions: 8,
      deletions: 1,
      firstCommit: '2024-03-19T08:00:00Z',
      lastCommit: '2024-03-19T08:00:00Z',
      activeDays: 1
    }
  ],
  fileChurn: [
    { file: 'src/auth.ts', changeCount: 3, insertions: 20, deletions: 3, authors: ['Alice Chen', 'Bob Smith'] },
    { file: 'src/api.ts', changeCount: 1, insertions: 5, deletions: 0, authors: ['Alice Chen'] },
    { file: 'src/utils.ts', changeCount: 1, insertions: 7, deletions: 2, authors: ['Bob Smith'] },
    { file: 'README.md', changeCount: 1, insertions: 4, deletions: 0, authors: ['Alice Chen'] },
    { file: 'docs/api.md', changeCount: 1, insertions: 8, deletions: 1, authors: ['Cara Jones'] }
  ],
  blameSummary: [
    {
      file: 'src/auth.ts',
      totalLines: 20,
      authors: [
        { author: 'Alice Chen', lines: 12, percentage: 60 },
        { author: 'Bob Smith', lines: 8, percentage: 40 }
      ]
    }
  ]
}

function extractDataPayload(html: string): unknown {
  const match = html.match(/const DATA = (.*?);\s+const tooltip/s)
  assert(match, 'embedded DATA payload missing')
  return JSON.parse(match[1])
}

test('generateReport returns string starting with doctype', () => {
  assert.match(generateReport(MOCK_DATA), /^<!DOCTYPE html>/)
})

test('output contains repoName in title', () => {
  assert.match(generateReport(MOCK_DATA), /<title>reposcope — my-repo<\/title>/)
})

test('output contains const DATA assignment', () => {
  assert.match(generateReport(MOCK_DATA), /const DATA = /)
})

test('embedded JSON is valid', () => {
  const payload = extractDataPayload(generateReport(MOCK_DATA))
  assert.equal(typeof payload, 'object')
})

test('embedded JSON has correct commit count', () => {
  const payload = extractDataPayload(generateReport(MOCK_DATA)) as RepoData
  assert.equal(payload.commits.length, 5)
})

test('embedded JSON has correct contributor names', () => {
  const payload = extractDataPayload(generateReport(MOCK_DATA)) as RepoData
  assert.deepEqual(payload.contributors.map((contributor) => contributor.author), ['Alice Chen', 'Bob Smith', 'Cara Jones'])
})

test('embedded JSON has correct branch count', () => {
  const payload = extractDataPayload(generateReport(MOCK_DATA)) as RepoData
  assert.equal(payload.branches.length, 3)
})

test('output contains d3 script link', () => {
  assert.match(generateReport(MOCK_DATA), /https:\/\/cdn\.jsdelivr\.net\/npm\/d3@7/)
})

test('output contains branch graph div id', () => {
  assert.match(generateReport(MOCK_DATA), /id="branch-graph"/)
})

test('output contains heatmap div id', () => {
  assert.match(generateReport(MOCK_DATA), /id="heatmap"/)
})

test('output contains churn div id', () => {
  assert.match(generateReport(MOCK_DATA), /id="churn"/)
})

test('output contains contributors section', () => {
  assert.match(generateReport(MOCK_DATA), /id="contributors-section"/)
})

test('output contains utf-8 meta charset', () => {
  assert.match(generateReport(MOCK_DATA), /<meta charset="utf-8">/)
})

test('empty commits array still generates valid html', () => {
  const html = generateReport({ ...MOCK_DATA, commits: [] })
  assert.match(html, /<!DOCTYPE html>/)
  assert.match(html, /const DATA = /)
})

test('single contributor still generates valid html', () => {
  const html = generateReport({ ...MOCK_DATA, contributors: [MOCK_DATA.contributors[0]] })
  assert.match(html, /<!DOCTYPE html>/)
})

test('long repoName is escaped in html title and header', () => {
  const html = generateReport({ ...MOCK_DATA, repoName: '<script>alert(1)</script>'.repeat(5) })
  assert.doesNotMatch(html, /<h1><script>/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
})

test('fileChurn data is embedded correctly', () => {
  const payload = extractDataPayload(generateReport(MOCK_DATA)) as RepoData
  assert.equal(payload.fileChurn[0].file, 'src/auth.ts')
  assert.equal(payload.fileChurn[0].changeCount, 3)
})

test('dates in output are rendered in human-readable format', () => {
  const html = generateReport(MOCK_DATA)
  assert.match(html, /Generated at 3\/20\/2024, 10:00:00 AM/)
})

test('output size is reasonable', () => {
  const html = generateReport(MOCK_DATA)
  assert.ok(html.length > 1000)
  assert.ok(html.length < 1_000_000)
})

test('generateReport is deterministic for same input', () => {
  assert.equal(generateReport(MOCK_DATA), generateReport(MOCK_DATA))
})

test('embedded JSON includes tags', () => {
  const payload = extractDataPayload(generateReport(MOCK_DATA)) as RepoData
  assert.deepEqual(payload.tags, ['v1.0.0'])
})

test('report includes timeline section anchor', () => {
  assert.match(generateReport(MOCK_DATA), /href="#timeline-section"/)
})

test('report includes blame table container', () => {
  assert.match(generateReport(MOCK_DATA), /id="blame-table"/)
})
