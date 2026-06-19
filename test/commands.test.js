import assert from 'node:assert/strict';
import { test } from 'node:test';

import { COMMANDS, helpText, runCommand } from '../src/commands.js';

function fakeClient() {
  const calls = [];
  return {
    calls,
    async listTools() {
      calls.push(['tools/list', {}]);
      return [{ name: 'memo_search' }];
    },
    async callTool(name, args) {
      calls.push([name, args]);
      return { ok: true, name, args };
    }
  };
}

test('COMMANDS exposes wrappers for every known flomo MCP tool family', () => {
  const usages = COMMANDS.map(([usage]) => usage);

  for (const expected of [
    'daily-review',
    'format-guide',
    'tag-guide',
    'search <keywords>',
    'get <id...>',
    'recommended <id>',
    'create <content...>',
    'update <id> [content...]',
    'tag-search <keywords>',
    'tag-tree [prefix]',
    'tag-rename <old_tag> [new_tag]',
    'memory-context',
    'memory-user',
    'call <tool>'
  ]) {
    assert.ok(usages.includes(expected), `missing ${expected}`);
  }
});

test('runCommand maps high-level commands to flomo MCP tool names and arguments', async () => {
  const cases = [
    ['daily-review', [], ['get_daily_review', {}]],
    ['format-guide', [], ['get_format_guide', {}]],
    ['tag-guide', [], ['get_tag_guide', {}]],
    ['search', ['AI', 'workflow', '--has-tag', 'true', '--limit', '2'], ['memo_search', { keywords: 'AI workflow', has_tag: true, limit: 2 }]],
    ['get', ['a', 'b'], ['memo_batch_get', { ids: ['a', 'b'] }]],
    ['recommended', ['memo-1', '--limit', '4', '--no-same-tag'], ['memo_recommended', { id: 'memo-1', limit: 4, no_same_tag: true }]],
    ['create', ['hello', '#tag'], ['memo_create', { content: 'hello #tag' }]],
    ['update', ['memo-1', 'changed', '--local-updated-at', '2026-06-19T00:00:00Z'], ['memo_update', { id: 'memo-1', content: 'changed', local_updated_at: '2026-06-19T00:00:00Z' }]],
    ['tag-search', ['AI', '--limit', '5'], ['tag_search', { keywords: 'AI', limit: 5 }]],
    ['tag-tree', ['读书', '--depth', '2'], ['tag_tree', { prefix: '读书', depth: 2 }]],
    ['tag-rename', ['old', 'new', '--max-memos', '10'], ['tag_rename', { old_tag: 'old', new_tag: 'new', max_memos: 10 }]],
    ['memory-context', [], ['memory_context', {}]],
    ['memory-user', [], ['memory_user', {}]],
    ['call', ['memo_search', '--arg', 'keywords=Codex', '--arg', 'limit=3'], ['memo_search', { keywords: 'Codex', limit: 3 }]]
  ];

  for (const [command, args, expected] of cases) {
    const client = fakeClient();
    await runCommand(client, command, [...args]);
    assert.deepEqual(client.calls.at(-1), expected, command);
  }
});

test('tools command calls tools/list directly', async () => {
  const client = fakeClient();

  const result = await runCommand(client, 'tools', []);

  assert.deepEqual(result, [{ name: 'memo_search' }]);
  assert.deepEqual(client.calls, [['tools/list', {}]]);
});

test('help advertises flomo-cli instead of the reserved flomo app name', () => {
  const text = helpText();

  assert.match(text, /^flomo-cli - CLI wrapper/);
  assert.match(text, /flomo-cli search Codex/);
  assert.doesNotMatch(text, /^flomo - CLI wrapper/);
});

test('help does not advertise Codex config as an auth fallback', () => {
  const text = helpText();

  assert.doesNotMatch(text, /Codex flomo config/);
  assert.match(text, /flomo-cli auth login/);
});
