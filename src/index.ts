#!/usr/bin/env node
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as process from 'node:process'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import chalk from 'chalk'
import { Command } from 'commander'

import { analyzeRepo } from './git.js'
import { serveReport } from './server.js'
import { generateReport } from './visualizer.js'

const execFileAsync = promisify(execFile)

async function openBrowser(targetUrl: string): Promise<void> {
  const platform = process.platform
  const opener = platform === 'darwin' ? 'open' : platform === 'win32' ? 'start' : 'xdg-open'
  if (opener === 'start') {
    await execFileAsync('cmd', ['/c', 'start', '', targetUrl])
    return
  }
  await execFileAsync(opener, [targetUrl])
}

function resolveRepoPath(repoPath?: string): string {
  return path.resolve(repoPath ?? '.')
}

function printSummary(data: Awaited<ReturnType<typeof analyzeRepo>>): void {
  console.log(`${chalk.green('✓')} ${data.commits.length} commits, ${data.branches.length} branches, ${data.contributors.length} contributors`)
}

const program = new Command()

program
  .name('reposcope')
  .description('Visualize Git repository history in a local HTML dashboard.')

program
  .command('analyze')
  .argument('[repo-path]', 'Path to git repository', '.')
  .option('-o, --output <file>', 'Output HTML file', 'reposcope-report.html')
  .option('-l, --limit <n>', 'Max commits to analyze', (value) => Number.parseInt(value, 10), 1000)
  .option('--json', 'Output raw JSON instead of HTML', false)
  .action(async (repoPath: string, options: { output: string; limit: number; json: boolean }) => {
    const targetRepo = resolveRepoPath(repoPath)
    console.log('Analyzing repository...')
    const data = await analyzeRepo(targetRepo, { limit: options.limit })
    printSummary(data)
    if (options.json) {
      console.log(JSON.stringify(data, null, 2))
      return
    }
    const html = generateReport(data)
    await fs.writeFile(options.output, html, 'utf8')
    console.log(`${chalk.green('✓')} Generated report: ${options.output}`)
  })

program
  .command('serve')
  .argument('[repo-path]', 'Path to git repository', '.')
  .option('-p, --port <n>', 'Port', (value) => Number.parseInt(value, 10), 4242)
  .option('--open', 'Auto-open browser', false)
  .action(async (repoPath: string, options: { port: number; open: boolean }) => {
    const targetRepo = resolveRepoPath(repoPath)
    const url = `http://localhost:${options.port}`
    await serveReport(targetRepo, options.port)
    console.log(`Serving at ${url}`)
    console.log('Open in browser to explore your repository')
    if (options.open) {
      await openBrowser(url)
    }
  })

program
  .command('stats')
  .argument('[repo-path]', 'Path to git repository', '.')
  .action(async (repoPath: string) => {
    const targetRepo = resolveRepoPath(repoPath)
    const data = await analyzeRepo(targetRepo, { limit: 1000 })
    console.log(`Repository: ${data.repoName}`)
    printSummary(data)
    const topContributor = data.contributors[0]
    if (topContributor) {
      console.log(`Top contributor: ${topContributor.author} (${topContributor.commitCount} commits)`)
    }
    const hottestFile = data.fileChurn[0]
    if (hottestFile) {
      console.log(`Most changed file: ${hottestFile.file} (${hottestFile.changeCount} changes)`)
    }
  })

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(chalk.red(error instanceof Error ? error.message : String(error)))
  process.exit(1)
})
