import { createServer as createHttpServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'

import { analyzeRepo } from './git.js'
import { generateReport } from './visualizer.js'

export interface ServerOptions {
  port?: number
}

type RepoAnalyzer = typeof analyzeRepo

function sendHtml(response: ServerResponse, html: string): void {
  response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
  response.end(html)
}

function sendJson(response: ServerResponse, payload: unknown): void {
  response.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(payload, null, 2))
}

export function createServer(repoPath: string, analyzer: RepoAnalyzer = analyzeRepo): Server {
  return createHttpServer(async (request: IncomingMessage, response: ServerResponse) => {
    try {
      const url = new URL(request.url ?? '/', 'http://localhost')
      const data = await analyzer(repoPath)
      if (url.pathname === '/data.json') {
        sendJson(response, data)
        return
      }
      sendHtml(response, generateReport(data))
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
      response.end(error instanceof Error ? error.message : 'Unknown server error')
    }
  })
}

export async function serveReport(repoPath: string, port = 4242): Promise<void> {
  const server = createServer(repoPath)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })
}
