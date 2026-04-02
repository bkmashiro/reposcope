import type { RepoData } from './git.js'

export interface RepoStats {
  totalCommits: number
  activeBranches: number
  topContributor: string
  mostChangedFile: string
  avgCommitsPerDay: number
  firstCommitDate: string
  lastCommitDate: string
  longestStreak: number
  commitsByDayOfWeek: number[]
}

function toDateKey(value: string): string {
  return value.slice(0, 10)
}

export function computeStats(data: RepoData): RepoStats {
  const sortedCommits = [...data.commits].sort((a, b) => a.date.localeCompare(b.date))
  const totalCommits = sortedCommits.length
  const firstCommitDate = sortedCommits[0]?.date ?? ''
  const lastCommitDate = sortedCommits.at(-1)?.date ?? ''
  const uniqueDays = [...new Set(sortedCommits.map((commit) => toDateKey(commit.date)))].sort()
  const daySpan = totalCommits === 0 || !firstCommitDate || !lastCommitDate
    ? 0
    : Math.max(1, Math.floor((new Date(lastCommitDate).getTime() - new Date(firstCommitDate).getTime()) / 86400000) + 1)

  let longestStreak = 0
  let currentStreak = 0
  let previousDay = ''
  for (const day of uniqueDays) {
    if (!previousDay) {
      currentStreak = 1
    } else {
      const diff = (new Date(day).getTime() - new Date(previousDay).getTime()) / 86400000
      currentStreak = diff === 1 ? currentStreak + 1 : 1
    }
    previousDay = day
    longestStreak = Math.max(longestStreak, currentStreak)
  }

  const commitsByDayOfWeek = new Array<number>(7).fill(0)
  for (const commit of sortedCommits) {
    commitsByDayOfWeek[new Date(commit.date).getUTCDay()] += 1
  }

  return {
    totalCommits,
    activeBranches: data.branches.length,
    topContributor: data.contributors[0]?.author ?? '',
    mostChangedFile: data.fileChurn[0]?.file ?? '',
    avgCommitsPerDay: daySpan === 0 ? totalCommits : Number((totalCommits / daySpan).toFixed(2)),
    firstCommitDate,
    lastCommitDate,
    longestStreak,
    commitsByDayOfWeek
  }
}

export function formatStats(stats: RepoStats): string {
  return [
    `Total Commits: ${stats.totalCommits}`,
    `Active Branches: ${stats.activeBranches}`,
    `Top Contributor: ${stats.topContributor || 'N/A'}`,
    `Most Changed File: ${stats.mostChangedFile || 'N/A'}`,
    `Average Commits Per Day: ${stats.avgCommitsPerDay}`,
    `First Commit Date: ${stats.firstCommitDate || 'N/A'}`,
    `Last Commit Date: ${stats.lastCommitDate || 'N/A'}`,
    `Longest Streak: ${stats.longestStreak}`,
    `Commits By Day Of Week: ${stats.commitsByDayOfWeek.join(', ')}`
  ].join('\n')
}
