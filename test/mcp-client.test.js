import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { McpHttpClient, parseSseJsonRpc } from '../src/mcp-client.js';

async function withMockMcpServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}/mcp`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('error', reject);
    request.on('end', () => resolve(JSON.parse(body)));
  });
}

function sendSse(response, payload, headers = {}) {
  response.writeHead(200, {
    'content-type': 'text/event-stream',
    ...headers
  });
  response.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
}

test('parseSseJsonRpc parses JSON-RPC payload from SSE response text', () => {
  const parsed = parseSseJsonRpc('event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"ok":true}}\n\n');

  assert.deepEqual(parsed, {
    jsonrpc: '2.0',
    id: 1,
    result: { ok: true }
  });
});

test('client initializes once and calls tools with bearer auth and session id', async () => {
  const seen = [];

  await withMockMcpServer(async (request, response) => {
    const body = await readJsonBody(request);
    seen.push({
      method: body.method,
      authorization: request.headers.authorization,
      session: request.headers['mcp-session-id'],
      body
    });

    if (body.method === 'initialize') {
      sendSse(response, {
        jsonrpc: '2.0',
        id: body.id,
        result: {
          protocolVersion: '2025-06-18',
          serverInfo: { name: 'flomo-mcp', version: '1.0.0' },
          capabilities: { tools: {} }
        }
      }, { 'mcp-session-id': 'session-123' });
      return;
    }

    if (body.method === 'notifications/initialized') {
      response.writeHead(202);
      response.end();
      return;
    }

    if (body.method === 'tools/call') {
      sendSse(response, {
        jsonrpc: '2.0',
        id: body.id,
        result: { structuredContent: { id: 'memo-1', content: 'hello' } }
      });
      return;
    }

    response.writeHead(500);
    response.end('unexpected method');
  }, async (url) => {
    const client = new McpHttpClient({ url, token: 'token-abc' });
    const result = await client.callTool('memo_create', { content: 'hello' });

    assert.deepEqual(result, { id: 'memo-1', content: 'hello' });
  });

  assert.deepEqual(seen.map((entry) => entry.method), [
    'initialize',
    'notifications/initialized',
    'tools/call'
  ]);
  assert.equal(seen[0].authorization, 'Bearer token-abc');
  assert.equal(seen[2].session, 'session-123');
  assert.deepEqual(seen[2].body.params, {
    name: 'memo_create',
    arguments: { content: 'hello' }
  });
});

test('client surfaces JSON-RPC errors with useful message', async () => {
  await withMockMcpServer(async (request, response) => {
    const body = await readJsonBody(request);

    if (body.method === 'initialize') {
      sendSse(response, {
        jsonrpc: '2.0',
        id: body.id,
        result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } }
      }, { 'mcp-session-id': 'session-err' });
      return;
    }

    if (body.method === 'notifications/initialized') {
      response.writeHead(202);
      response.end();
      return;
    }

    sendSse(response, {
      jsonrpc: '2.0',
      id: body.id,
      error: { code: -32602, message: 'missing content' }
    });
  }, async (url) => {
    const client = new McpHttpClient({ url, token: 'token-abc' });

    await assert.rejects(
      () => client.callTool('memo_create', {}),
      /missing content/
    );
  });
});
