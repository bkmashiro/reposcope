import test from 'node:test'
import assert from 'node:assert/strict'

import { highlightMatch, searchCommits } from '../src/search.js'
import type { CommitData } from '../src/git.js'

const COMMITS: CommitData[] = [
  {
    hash: 'a1',
    shortHash: 'a1',
    date: '2024-03-15T10:00:00.000Z',
    author: 'Alice Chen',
    email: 'alice@co.com',
    subject: 'feat: add auth module',
    parents: [],
    files: ['src/auth.ts', 'src/session.ts']
  },
  {
    hash: 'b2',
    shortHash: 'b2',
    date: '2024-03-16T10:00:00.000Z',
    author: 'Bob Smith',
    email: 'bob@co.com',
    subject: 'fix: auth null check',
    parents: ['a1'],
    files: ['src/auth.ts']
  },
  {
    hash: 'c3',
    shortHash: 'c3',
    date: '2024-03-20T10:00:00.000Z',
    author: 'Cara Jones',
    email: 'cara@co.com',
    subject: 'docs: write guide',
    parents: ['b2'],
    files: ['docs/auth.md']
  }
]

test('searchCommits finds match in subject', () => {
  const results = searchCommits(COMMITS, { query: 'auth', field: 'subject' })
  assert.equal(results.length, 2)
  assert.equal(results[0].matchedField, 'subject')
})

test('searchCommits finds match by author name', () => {
  const results = searchCommits(COMMITS, { query: 'alice', field: 'author' })
  assert.equal(results.length, 1)
  assert.equal(results[0].commit.author, 'Alice Chen')
})

test('searchCommits returns empty for no match', () => {
  assert.deepEqual(searchCommits(COMMITS, { query: 'payments', field: 'all' }), [])
})

test('searchCommits respects limit option', () => {
  const results = searchCommits(COMMITS, { query: 'auth', field: 'all', limit: 1 })
  assert.equal(results.length, 1)
})

test('searchCommits field all searches all fields', () => {
  const results = searchCommits(COMMITS, { query: 'docs/auth.md', field: 'all' })
  assert.equal(results.length, 1)
  assert.equal(results[0].matchedField, 'file')
})

test('exact match scores higher than partial match', () => {
  const results = searchCommits(COMMITS, { query: 'src/auth.ts', field: 'file' })
  assert.ok(results[0].score >= results[1].score)
})

test('results are sorted by score descending', () => {
  const results = searchCommits(COMMITS, { query: 'auth', field: 'subject' })
  assert.ok(results[0].score >= results[1].score)
})

test('highlightMatch wraps matched text in bold markers', () => {
  assert.equal(highlightMatch('feat: add auth module', 'auth'), 'feat: add **auth** module')
})

test('highlightMatch handles no match by returning original text', () => {
  assert.equal(highlightMatch('feat: add auth module', 'payments'), 'feat: add auth module')
})

test('highlightMatch is case-insensitive', () => {
  assert.equal(highlightMatch('Alice Chen', 'alice'), '**Alice** Chen')
})

test('since filter excludes old commits', () => {
  const results = searchCommits(COMMITS, { query: 'auth', field: 'all', since: '2024-03-16T00:00:00Z' })
  assert.equal(results.some((result) => result.commit.hash === 'a1'), false)
})

test('until filter excludes future commits', () => {
  const results = searchCommits(COMMITS, { query: 'guide', field: 'all', until: '2024-03-19T23:59:59Z' })
  assert.equal(results.length, 0)
})
