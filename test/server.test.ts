import test from 'node:test'
import assert from 'node:assert/strict'
import * as http from 'node:http'

import { createServer } from '../src/server.js'

test('createServer returns object with listen method', () => {
  const server = createServer('.')
  assert.equal(typeof server.listen, 'function')
  server.close()
})

test('request to / returns html content type', async () => {
  const server = createServer('.', async () => ({
    repoName: 'demo',
    analyzedAt: '2024-03-20T10:00:00Z',
    branches: ['main'],
    tags: [],
    commits: [],
    contributors: [],
    fileChurn: [],
    blameSummary: []
  }))

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address === 'object')

  const response = await new Promise<{ statusCode?: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
    http.get(`http://127.0.0.1:${address.port}/`, (res: http.IncomingMessage) => {
      let body = ''
      res.setEncoding('utf8')
      res.on('data', (chunk: string) => {
        body += chunk
      })
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }))
    }).on('error', reject)
  })

  assert.equal(response.statusCode, 200)
  assert.match(response.headers['content-type'] ?? '', /text\/html/)
  assert.match(response.body, /<!DOCTYPE html>/)

  server.close()
})
