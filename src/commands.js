import { readFileSync } from 'node:fs';

import { parseBoolean, parseFlagValue, parseInteger, parseKeyValue } from './args.js';

export const COMMANDS = [
  ['tools', 'List MCP tools exposed by flomo.'],
  ['daily-review', 'Get today daily review memos.'],
  ['format-guide', 'Show flomo formatting rules.'],
  ['tag-guide', 'Show flomo tag rules and best practices.'],
  ['search <keywords>', 'Search memos with optional filters.'],
  ['get <id...>', 'Fetch one or more memo details by id.'],
  ['recommended <id>', 'Find memos related to a memo.'],
  ['create <content...>', 'Create a memo. Use --stdin to read content from stdin.'],
  ['update <id> [content...]', 'Update a memo. Use --stdin to read content from stdin.'],
  ['tag-search <keywords>', 'Search tags by name.'],
  ['tag-tree [prefix]', 'Read a tag tree.'],
  ['tag-rename <old_tag> [new_tag]', 'Rename a tag across memos.'],
  ['memory-context', 'Read flomo memory.md context.'],
  ['memory-user', 'Read flomo user.md profile.'],
  ['auth login', 'Save a flomo personal token created in the flomo App.'],
  ['call <tool>', 'Call any MCP tool with --arg key=value or --args-json JSON.']
];

export function helpText() {
  return `flomo-cli - CLI wrapper for flomo MCP

Usage:
  flomo-cli [global options] <command> [command options]

Global options:
  --url <url>       MCP endpoint. Defaults to FLOMO_MCP_URL or https://flomoapp.com/mcp
  --token <token>   Bearer token. Defaults to FLOMO_MCP_TOKEN, FLOMO_TOKEN, or saved auth config
  --json            Print machine-readable JSON
  -h, --help        Show help

Commands:
${COMMANDS.map(([usage, description]) => `  ${usage.padEnd(28)} ${description}`).join('\n')}

Examples:
  flomo-cli search Codex --tag AI --limit 5
  flomo-cli create "#想法 from CLI"
  printf "long memo" | flomo-cli create --stdin
  flomo-cli get memo_id --json
  flomo-cli call memo_search --arg keywords=Codex --arg limit=3 --json

Auth:
  Open flomo App -> flomo AI -> MCP 连接 -> 个人 Token -> 创建.
  Copy the token, then run: flomo-cli auth login
`;
}

function takeFlag(argv, index, name) {
  if (argv[index] === name || argv[index].startsWith(`${name}=`)) {
    return parseFlagValue(argv, index, name);
  }
  return null;
}

function readStdin() {
  return readFileSync(0, 'utf8').trim();
}

function parseSearch(args) {
  const params = {};
  const keywords = [];

  for (let index = 0; index < args.length;) {
    const arg = args[index];
    const valueFlag = ['--tag', '--start-date', '--end-date', '--from', '--limit'].find((flag) => arg === flag || arg.startsWith(`${flag}=`));
    if (valueFlag) {
      const { value, consumed } = takeFlag(args, index, valueFlag);
      const key = valueFlag.slice(2).replaceAll('-', '_');
      params[key] = key === 'limit' ? parseInteger(value, '--limit') : value;
      index += consumed;
      continue;
    }

    if (arg === '--has-tag' || arg.startsWith('--has-tag=')) {
      const { value, consumed } = takeFlag(args, index, '--has-tag');
      params.has_tag = parseBoolean(value, '--has-tag');
      index += consumed;
      continue;
    }

    keywords.push(arg);
    index += 1;
  }

  if (keywords.length > 0) {
    params.keywords = keywords.join(' ');
  }

  return params;
}

function parseCreateOrUpdate(args, { update = false } = {}) {
  const params = {};
  const contentParts = [];

  if (update) {
    params.id = args.shift();
    if (!params.id) {
      throw new Error('id is required');
    }
  }

  for (let index = 0; index < args.length;) {
    const arg = args[index];

    if (arg === '--format' || arg.startsWith('--format=')) {
      const { value, consumed } = takeFlag(args, index, '--format');
      params.format = value;
      index += consumed;
      continue;
    }

    if (arg === '--local-updated-at' || arg.startsWith('--local-updated-at=')) {
      const { value, consumed } = takeFlag(args, index, '--local-updated-at');
      params.local_updated_at = value;
      index += consumed;
      continue;
    }

    if (arg === '--stdin') {
      contentParts.push(readStdin());
      index += 1;
      continue;
    }

    contentParts.push(arg);
    index += 1;
  }

  const content = contentParts.join(' ').trim();
  if (content) {
    params.content = content;
  }

  if (!update && !params.content) {
    throw new Error('content is required; pass content arguments or use --stdin');
  }

  return params;
}

function parseRecommended(args) {
  const id = args.shift();
  if (!id) {
    throw new Error('id is required');
  }
  const params = { id };

  for (let index = 0; index < args.length;) {
    const arg = args[index];
    if (arg === '--limit' || arg.startsWith('--limit=')) {
      const { value, consumed } = takeFlag(args, index, '--limit');
      params.limit = parseInteger(value, '--limit');
      index += consumed;
      continue;
    }
    if (arg === '--no-same-tag') {
      params.no_same_tag = true;
      index += 1;
      continue;
    }
    throw new Error(`Unknown recommended option: ${arg}`);
  }

  return params;
}

function parseTagTree(args) {
  const params = {};
  const positional = [];

  for (let index = 0; index < args.length;) {
    const arg = args[index];
    if (arg === '--depth' || arg.startsWith('--depth=')) {
      const { value, consumed } = takeFlag(args, index, '--depth');
      params.depth = parseInteger(value, '--depth');
      index += consumed;
      continue;
    }
    positional.push(arg);
    index += 1;
  }

  if (positional[0]) {
    params.prefix = positional[0];
  }

  return params;
}

function parseTagRename(args) {
  const [oldTag, newTag, ...rest] = args;
  if (!oldTag) {
    throw new Error('old_tag is required');
  }
  const params = { old_tag: oldTag };
  if (newTag && !newTag.startsWith('--')) {
    params.new_tag = newTag;
  } else if (newTag) {
    rest.unshift(newTag);
  }

  for (let index = 0; index < rest.length;) {
    const arg = rest[index];
    if (arg === '--max-memos' || arg.startsWith('--max-memos=')) {
      const { value, consumed } = takeFlag(rest, index, '--max-memos');
      params.max_memos = parseInteger(value, '--max-memos');
      index += consumed;
      continue;
    }
    throw new Error(`Unknown tag-rename option: ${arg}`);
  }

  return params;
}

function parseCall(args) {
  const tool = args.shift();
  if (!tool) {
    throw new Error('tool is required');
  }

  const params = {};
  for (let index = 0; index < args.length;) {
    const arg = args[index];
    if (arg === '--args-json' || arg.startsWith('--args-json=')) {
      const { value, consumed } = takeFlag(args, index, '--args-json');
      Object.assign(params, JSON.parse(value));
      index += consumed;
      continue;
    }
    if (arg === '--arg' || arg.startsWith('--arg=')) {
      const { value, consumed } = takeFlag(args, index, '--arg');
      const [key, parsedValue] = parseKeyValue(value);
      params[key] = parsedValue;
      index += consumed;
      continue;
    }
    throw new Error(`Unknown call option: ${arg}`);
  }

  return { tool, params };
}

export async function runCommand(client, command, args) {
  switch (command) {
    case 'tools':
      return client.listTools();
    case 'daily-review':
      return client.callTool('get_daily_review', {});
    case 'format-guide':
      return client.callTool('get_format_guide', {});
    case 'tag-guide':
      return client.callTool('get_tag_guide', {});
    case 'search':
      return client.callTool('memo_search', parseSearch(args));
    case 'get':
      if (args.length === 0) {
        throw new Error('at least one id is required');
      }
      return client.callTool('memo_batch_get', { ids: args });
    case 'recommended':
      return client.callTool('memo_recommended', parseRecommended(args));
    case 'create':
      return client.callTool('memo_create', parseCreateOrUpdate(args));
    case 'update':
      return client.callTool('memo_update', parseCreateOrUpdate(args, { update: true }));
    case 'tag-search': {
      const keywords = args.shift();
      if (!keywords) {
        throw new Error('keywords is required');
      }
      const params = { keywords };
      if (args[0] === '--limit' || args[0]?.startsWith('--limit=')) {
        const { value } = takeFlag(args, 0, '--limit');
        params.limit = parseInteger(value, '--limit');
      }
      return client.callTool('tag_search', params);
    }
    case 'tag-tree':
      return client.callTool('tag_tree', parseTagTree(args));
    case 'tag-rename':
      return client.callTool('tag_rename', parseTagRename(args));
    case 'memory-context':
      return client.callTool('memory_context', {});
    case 'memory-user':
      return client.callTool('memory_user', {});
    case 'call': {
      const { tool, params } = parseCall(args);
      return client.callTool(tool, params);
    }
    default:
      throw new Error(`Unknown command: ${command || '(none)'}`);
  }
}
