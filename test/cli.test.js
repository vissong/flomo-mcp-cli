import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

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

function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['./src/cli.js', ...args], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function runCliWithInput(args, env, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['./src/cli.js', ...args], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, ...env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
    child.stdin.end(input);
  });
}

test('search command sends memo_search arguments and prints JSON', async () => {
  await withMockMcpServer(async (request, response) => {
    const body = await readJsonBody(request);

    if (body.method === 'initialize') {
      sendSse(response, {
        jsonrpc: '2.0',
        id: body.id,
        result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } }
      }, { 'mcp-session-id': 'cli-session' });
      return;
    }

    if (body.method === 'notifications/initialized') {
      response.writeHead(202);
      response.end();
      return;
    }

    assert.equal(body.method, 'tools/call');
    assert.deepEqual(body.params, {
      name: 'memo_search',
      arguments: {
        keywords: 'Codex',
        tag: 'AI',
        limit: 3
      }
    });
    sendSse(response, {
      jsonrpc: '2.0',
      id: body.id,
      result: { structuredContent: { memos: [{ id: '1', content: 'Codex note' }] } }
    });
  }, async (url) => {
    const result = await runCli(['search', 'Codex', '--tag', 'AI', '--limit', '3', '--json'], {
      FLOMO_MCP_URL: url,
      FLOMO_MCP_TOKEN: 'cli-token'
    });

    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      memos: [{ id: '1', content: 'Codex note' }]
    });
  });
});

test('create command requires content from arg or stdin', async () => {
  const result = await runCli(['create'], {
    FLOMO_MCP_URL: 'http://127.0.0.1:9/mcp',
    FLOMO_MCP_TOKEN: 'cli-token'
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /content is required/i);
});

test('help includes the main flomo wrappers', async () => {
  const result = await runCli(['--help'], {});

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /daily-review/);
  assert.match(result.stdout, /search/);
  assert.match(result.stdout, /tag-rename/);
  assert.match(result.stdout, /memory-user/);
});

test('installed flomo-cli bin symlink still runs the CLI entrypoint', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flomo-bin-'));
  const binPath = join(dir, 'flomo-cli');
  await symlink(new URL('../src/cli.js', import.meta.url), binPath);

  const result = await new Promise((resolve) => {
    const child = spawn(binPath, ['--help'], {
      cwd: new URL('..', import.meta.url),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /flomo-cli - CLI wrapper/);
});

test('auth login stores a user-created personal token', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flomo-auth-'));
  const result = await runCli(['auth', 'login', '--token', 'fmcp_test_token'], {
    XDG_CONFIG_HOME: dir
  });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Saved flomo personal token/);

  const raw = await readFile(join(dir, 'flomo-cli', 'config.json'), 'utf8');
  assert.equal(JSON.parse(raw).token, 'fmcp_test_token');
});

test('auth login can read token from stdin', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flomo-auth-stdin-'));
  const result = await runCliWithInput(['auth', 'login'], {
    XDG_CONFIG_HOME: dir
  }, 'fmcp_stdin_token\n');

  assert.equal(result.code, 0, result.stderr);
  const raw = await readFile(join(dir, 'flomo-cli', 'config.json'), 'utf8');
  assert.equal(JSON.parse(raw).token, 'fmcp_stdin_token');
});

test('missing auth tells user to create a personal token in flomo app', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'flomo-no-auth-'));
  const result = await runCli(['tools'], {
    XDG_CONFIG_HOME: dir,
    FLOMO_MCP_TOKEN: '',
    FLOMO_TOKEN: ''
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /flomo App/);
  assert.match(result.stderr, /flomo AI/);
  assert.match(result.stderr, /个人 Token/);
  assert.match(result.stderr, /flomo-cli auth login/);
});
