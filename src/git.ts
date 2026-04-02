import * as childProcess from 'node:child_process'
import * as path from 'node:path'

export interface CommitData {
  hash: string
  shortHash: string
  date: string
  author: string
  email: string
  subject: string
  parents: string[]
  branch?: string
}

export interface FileChurn {
  file: string
  changeCount: number
  insertions: number
  deletions: number
  authors: string[]
}

export interface ContributorStats {
  author: string
  email: string
  commitCount: number
  insertions: number
  deletions: number
  firstCommit: string
  lastCommit: string
  activeDays: number
}

export interface BlameSummary {
  file: string
  totalLines: number
  authors: Array<{
    author: string
    lines: number
    percentage: number
  }>
}

export interface RepoData {
  commits: CommitData[]
  branches: string[]
  tags: string[]
  contributors: ContributorStats[]
  fileChurn: FileChurn[]
  blameSummary: BlameSummary[]
  repoName: string
  analyzedAt: string
}

interface AnalyzeOptions {
  limit?: number
}

type GitRunner = (repoPath: string, args: string[]) => string

let gitRunner: GitRunner = (repoPath, args) => {
  const command = `git ${args.map((arg) => shellQuote(arg)).join(' ')}`
  return childProcess.execSync(command, {
    cwd: repoPath,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 64
  })
}

function runGit(repoPath: string, args: string[]): string {
  return gitRunner(repoPath, args)
}

function shellQuote(value: string): string {
  return JSON.stringify(value)
}

function getRepoName(repoPath: string): string {
  return path.basename(path.resolve(repoPath))
}

function clampLimit(limit?: number): number | undefined {
  if (limit === undefined || Number.isNaN(limit)) {
    return undefined
  }
  return Math.max(1, Math.floor(limit))
}

export function parseCommitLog(output: string): CommitData[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [hash, shortHash, date, author, email, subject, parentString = ''] = line.split('|')
      return {
        hash,
        shortHash,
        date,
        author,
        email,
        subject,
        parents: parentString ? parentString.split(' ').filter(Boolean) : []
      }
    })
}

export function parseContributorActivity(output: string): Map<string, Set<string>> {
  const byEmail = new Map<string, Set<string>>()
  for (const line of output.split('\n')) {
    if (!line.trim()) {
      continue
    }
    const [date, email] = line.split('|')
    const key = email.trim()
    const day = date.slice(0, 10)
    if (!byEmail.has(key)) {
      byEmail.set(key, new Set())
    }
    byEmail.get(key)?.add(day)
  }
  return byEmail
}

export function parseNumstat(output: string): Array<{
  commit: string
  insertions: number
  deletions: number
  file: string
}> {
  const results: Array<{
    commit: string
    insertions: number
    deletions: number
    file: string
  }> = []

  let currentCommit = ''
  for (const rawLine of output.split('\n')) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }
    if (!line.includes('\t')) {
      currentCommit = line
      continue
    }
    const [insertionsRaw, deletionsRaw, ...fileParts] = line.split('\t')
    const file = fileParts.join('\t')
    results.push({
      commit: currentCommit,
      insertions: insertionsRaw === '-' ? 0 : Number.parseInt(insertionsRaw, 10) || 0,
      deletions: deletionsRaw === '-' ? 0 : Number.parseInt(deletionsRaw, 10) || 0,
      file
    })
  }
  return results
}

export function parseContributors(
  commits: CommitData[],
  activity: Map<string, Set<string>>,
  numstat: Array<{ commit: string; insertions: number; deletions: number; file: string }>
): ContributorStats[] {
  const stats = new Map<string, ContributorStats>()
  const commitToAuthor = new Map<string, { author: string; email: string }>()

  for (const commit of commits) {
    commitToAuthor.set(commit.hash, { author: commit.author, email: commit.email })
    const existing = stats.get(commit.email)
    if (existing) {
      existing.commitCount += 1
      if (commit.date < existing.firstCommit) {
        existing.firstCommit = commit.date
      }
      if (commit.date > existing.lastCommit) {
        existing.lastCommit = commit.date
      }
      continue
    }
    stats.set(commit.email, {
      author: commit.author,
      email: commit.email,
      commitCount: 1,
      insertions: 0,
      deletions: 0,
      firstCommit: commit.date,
      lastCommit: commit.date,
      activeDays: activity.get(commit.email)?.size ?? 0
    })
  }

  for (const entry of numstat) {
    const contributor = commitToAuthor.get(entry.commit)
    if (!contributor) {
      continue
    }
    const target = stats.get(contributor.email)
    if (!target) {
      continue
    }
    target.insertions += entry.insertions
    target.deletions += entry.deletions
  }

  for (const [email, target] of stats) {
    target.activeDays = activity.get(email)?.size ?? 0
  }

  return [...stats.values()].sort((a, b) => b.commitCount - a.commitCount || a.author.localeCompare(b.author))
}

export function parseFileChurn(
  output: string,
  commitMap: Map<string, CommitData>,
  limit = 25
): FileChurn[] {
  const stats = new Map<string, FileChurn>()
  for (const entry of parseNumstat(output)) {
    const commit = commitMap.get(entry.commit)
    if (!stats.has(entry.file)) {
      stats.set(entry.file, {
        file: entry.file,
        changeCount: 0,
        insertions: 0,
        deletions: 0,
        authors: []
      })
    }
    const target = stats.get(entry.file)
    if (!target) {
      continue
    }
    target.changeCount += 1
    target.insertions += entry.insertions
    target.deletions += entry.deletions
    if (commit && !target.authors.includes(commit.author)) {
      target.authors.push(commit.author)
    }
  }

  return [...stats.values()]
    .sort((a, b) => b.changeCount - a.changeCount || b.insertions + b.deletions - (a.insertions + a.deletions))
    .slice(0, limit)
}

export function parseBlamePorcelain(output: string, file: string): BlameSummary {
  const counts = new Map<string, number>()
  let totalLines = 0

  for (const rawLine of output.split('\n')) {
    if (!rawLine.startsWith('author ')) {
      continue
    }
    const author = rawLine.slice('author '.length).trim() || 'Unknown'
    counts.set(author, (counts.get(author) ?? 0) + 1)
    totalLines += 1
  }

  const authors = [...counts.entries()]
    .map(([author, lines]) => ({
      author,
      lines,
      percentage: totalLines === 0 ? 0 : Number(((lines / totalLines) * 100).toFixed(1))
    }))
    .sort((a, b) => b.lines - a.lines)

  return { file, totalLines, authors }
}

export function setGitRunner(runner: GitRunner): void {
  gitRunner = runner
}

export function resetGitRunner(): void {
  gitRunner = (repoPath, args) => {
    const command = `git ${args.map((arg) => shellQuote(arg)).join(' ')}`
    return childProcess.execSync(command, {
      cwd: repoPath,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 64
    })
  }
}

async function getBranches(repoPath: string): Promise<string[]> {
  const output = runGit(repoPath, ['branch', '--format=%(refname:short)'])
  return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function getTags(repoPath: string): Promise<string[]> {
  const output = runGit(repoPath, ['tag', '--list'])
  return output.split('\n').map((line) => line.trim()).filter(Boolean)
}

async function assignBranches(repoPath: string, commits: CommitData[], branches: string[]): Promise<CommitData[]> {
  const byHash = new Map(commits.map((commit) => [commit.hash, commit]))
  for (const branch of branches) {
    const output = runGit(repoPath, ['rev-list', branch])
    for (const hash of output.split('\n').map((line) => line.trim()).filter(Boolean)) {
      const commit = byHash.get(hash)
      if (commit && !commit.branch) {
        commit.branch = branch
      }
    }
  }
  return commits
}

export async function getCommitGraph(repoPath: string, limit?: number): Promise<CommitData[]> {
  const args = ['log', '--format=%H|%h|%aI|%an|%ae|%s|%P', '--all']
  const safeLimit = clampLimit(limit)
  if (safeLimit) {
    args.push(`-${safeLimit}`)
  }
  const commits = parseCommitLog(runGit(repoPath, args))
  const branches = await getBranches(repoPath)
  return assignBranches(repoPath, commits, branches)
}

export async function getFileChurn(repoPath: string, limit = 25): Promise<FileChurn[]> {
  const commits = await getCommitGraph(repoPath)
  const commitMap = new Map(commits.map((commit) => [commit.hash, commit]))
  const output = runGit(repoPath, ['log', '--all', '--diff-filter=ACMRT', '--numstat', '--format=%H'])
  return parseFileChurn(output, commitMap, limit)
}

export async function getContributors(repoPath: string): Promise<ContributorStats[]> {
  const commits = await getCommitGraph(repoPath)
  const activity = parseContributorActivity(runGit(repoPath, ['log', '--format=%aI|%ae', '--all']))
  const numstat = parseNumstat(runGit(repoPath, ['log', '--all', '--diff-filter=ACMRT', '--numstat', '--format=%H']))
  return parseContributors(commits, activity, numstat)
}

export async function getBlameSummary(repoPath: string, files: string[], limit = 10): Promise<BlameSummary[]> {
  const summaries: BlameSummary[] = []
  for (const file of files.slice(0, limit)) {
    try {
      const output = runGit(repoPath, ['blame', '--line-porcelain', 'HEAD', '--', file])
      summaries.push(parseBlamePorcelain(output, file))
    } catch {
      summaries.push({ file, totalLines: 0, authors: [] })
    }
  }
  return summaries
}

export async function analyzeRepo(repoPath: string, options: AnalyzeOptions = {}): Promise<RepoData> {
  const commits = await getCommitGraph(repoPath, options.limit)
  const branches = await getBranches(repoPath)
  const tags = await getTags(repoPath)
  const activity = parseContributorActivity(runGit(repoPath, ['log', '--format=%aI|%ae', '--all']))
  const numstatOutput = runGit(repoPath, ['log', '--all', '--diff-filter=ACMRT', '--numstat', '--format=%H'])
  const numstat = parseNumstat(numstatOutput)
  const contributors = parseContributors(commits, activity, numstat)
  const commitMap = new Map(commits.map((commit) => [commit.hash, commit]))
  const fileChurn = parseFileChurn(numstatOutput, commitMap)
  const blameSummary = await getBlameSummary(repoPath, fileChurn.map((entry) => entry.file))

  return {
    commits,
    branches,
    tags,
    contributors,
    fileChurn,
    blameSummary,
    repoName: getRepoName(repoPath),
    analyzedAt: new Date().toISOString()
  }
}
