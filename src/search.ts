import type { CommitData } from './git.js'

export interface SearchOptions {
  query: string
  field: 'subject' | 'author' | 'file' | 'all'
  since?: string
  until?: string
  limit?: number
}

export interface SearchResult {
  commit: CommitData
  matchedField: string
  matchedValue: string
  score: number
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function includesDate(commitDate: string, since?: string, until?: string): boolean {
  const commitTime = new Date(commitDate).getTime()
  if (Number.isNaN(commitTime)) {
    return true
  }
  if (since) {
    const sinceTime = new Date(since).getTime()
    if (!Number.isNaN(sinceTime) && commitTime < sinceTime) {
      return false
    }
  }
  if (until) {
    const untilTime = new Date(until).getTime()
    if (!Number.isNaN(untilTime) && commitTime > untilTime) {
      return false
    }
  }
  return true
}

function scoreMatch(value: string, query: string): number {
  const haystack = normalize(value)
  const needle = normalize(query)
  if (!haystack || !needle) {
    return 0
  }
  if (haystack === needle) {
    return 1
  }
  if (haystack.startsWith(needle)) {
    return 0.92
  }
  const index = haystack.indexOf(needle)
  if (index >= 0) {
    return Math.max(0.55, 0.88 - index * 0.03)
  }
  const compactNeedle = needle.replace(/\s+/g, '')
  const compactHaystack = haystack.replace(/\s+/g, '')
  if (compactNeedle && compactHaystack.includes(compactNeedle)) {
    return 0.5
  }
  return 0
}

function getCandidates(commit: CommitData, field: SearchOptions['field']): Array<{ field: string; value: string }> {
  if (field === 'subject') {
    return [{ field: 'subject', value: commit.subject }]
  }
  if (field === 'author') {
    return [
      { field: 'author', value: commit.author },
      { field: 'author', value: commit.email }
    ]
  }
  if (field === 'file') {
    return (commit.files ?? []).map((value) => ({ field: 'file', value }))
  }
  return [
    { field: 'subject', value: commit.subject },
    { field: 'author', value: commit.author },
    { field: 'author', value: commit.email },
    ...(commit.files ?? []).map((value) => ({ field: 'file', value }))
  ]
}

export function searchCommits(commits: CommitData[], options: SearchOptions): SearchResult[] {
  const query = options.query.trim()
  if (!query) {
    return []
  }

  const results: SearchResult[] = []
  for (const commit of commits) {
    if (!includesDate(commit.date, options.since, options.until)) {
      continue
    }

    let best: SearchResult | undefined
    for (const candidate of getCandidates(commit, options.field)) {
      const score = scoreMatch(candidate.value, query)
      if (score === 0) {
        continue
      }
      if (!best || score > best.score) {
        best = {
          commit,
          matchedField: candidate.field,
          matchedValue: candidate.value,
          score
        }
      }
    }

    if (best) {
      results.push(best)
    }
  }

  const limited = results.sort((a, b) => b.score - a.score || b.commit.date.localeCompare(a.commit.date))
  const safeLimit = options.limit === undefined ? limited.length : Math.max(1, Math.floor(options.limit))
  return limited.slice(0, safeLimit)
}

export function highlightMatch(text: string, query: string): string {
  const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!escapedQuery) {
    return text
  }
  const matcher = new RegExp(escapedQuery, 'i')
  const match = text.match(matcher)
  if (!match || match.index === undefined) {
    return text
  }
  const start = match.index
  const end = start + match[0].length
  return `${text.slice(0, start)}**${text.slice(start, end)}**${text.slice(end)}`
}
