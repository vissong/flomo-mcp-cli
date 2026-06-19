#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { helpText, runCommand } from './commands.js';
import { DEFAULT_MCP_URL, getConfigPath, resolveConfig, writeStoredConfig } from './config.js';
import { printResult } from './format.js';
import { McpHttpClient } from './mcp-client.js';

function takeGlobalFlag(argv, index, name) {
  const current = argv[index];
  if (current === name) {
    if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
      throw new Error(`${name} requires a value`);
    }
    return { value: argv[index + 1], consumed: 2 };
  }
  if (current.startsWith(`${name}=`)) {
    return { value: current.slice(name.length + 1), consumed: 1 };
  }
  return null;
}

function parseGlobalArgs(argv) {
  const options = {
    json: false
  };
  const rest = [];

  for (let index = 0; index < argv.length;) {
    const arg = argv[index];

    if (arg === '--json') {
      options.json = true;
      index += 1;
      continue;
    }
    if (arg === '--url' || arg.startsWith('--url=')) {
      const { value, consumed } = takeGlobalFlag(argv, index, '--url');
      options.url = value;
      index += consumed;
      continue;
    }
    if (arg === '--token' || arg.startsWith('--token=')) {
      const { value, consumed } = takeGlobalFlag(argv, index, '--token');
      options.token = value;
      index += consumed;
      continue;
    }

    rest.push(arg);
    index += 1;
  }

  return { options, rest };
}

function missingAuthMessage() {
  return [
    'flomo personal token is required.',
    '',
    'Create one in flomo App first:',
    '1. Open flomo App.',
    '2. Go to flomo AI.',
    '3. Open MCP 连接.',
    '4. Choose 个人 Token.',
    '5. Click 创建 and copy the token.',
    '',
    'Then run:',
    '  flomo-cli auth login',
    '',
    'For scripts, you can also pass --token or set FLOMO_MCP_TOKEN.'
  ].join('\n');
}

function parseAuthArgs(args) {
  const subcommand = args.shift();
  if (subcommand !== 'login') {
    throw new Error(`Unknown auth command: ${subcommand || '(none)'}`);
  }

  const options = {};
  for (let index = 0; index < args.length;) {
    const arg = args[index];
    if (arg === '--token') {
      if (!args[index + 1]) {
        throw new Error('--token requires a value');
      }
      options.token = args[index + 1];
      index += 2;
      continue;
    }
    if (arg.startsWith('--token=')) {
      options.token = arg.slice('--token='.length);
      index += 1;
      continue;
    }
    throw new Error(`Unknown auth login option: ${arg}`);
  }

  return options;
}

async function readTokenFromInput(streams) {
  if (!streams.stdin.isTTY) {
    return readFileSync(0, 'utf8').trim();
  }

  streams.stderr.write([
    'Create a personal token in flomo App first:',
    'flomo AI -> MCP 连接 -> 个人 Token -> 创建',
    ''
  ].join('\n'));

  const readline = createInterface({
    input: streams.stdin,
    output: streams.stderr
  });

  try {
    return (await readline.question('Paste flomo personal token: ')).trim();
  } finally {
    readline.close();
  }
}

async function runAuth(args, options, streams) {
  const authOptions = parseAuthArgs(args);
  const token = (authOptions.token || options.token || await readTokenFromInput(streams)).trim();

  if (!token) {
    throw new Error('token is required');
  }

  writeStoredConfig({
    url: options.url || process.env.FLOMO_MCP_URL || DEFAULT_MCP_URL,
    token
  });

  streams.stdout.write(`Saved flomo personal token to ${getConfigPath()}\n`);
  return 0;
}

export async function main(argv = process.argv.slice(2), streams = process) {
  const { options, rest } = parseGlobalArgs(argv);
  const command = rest.shift();

  if (!command || command === '--help' || command === '-h' || command === 'help') {
    streams.stdout.write(helpText());
    return 0;
  }

  if (command === 'auth') {
    return runAuth(rest, options, streams);
  }

  const config = resolveConfig(options);
  if (!config.token) {
    throw new Error(missingAuthMessage());
  }

  const client = new McpHttpClient(config);
  const result = await runCommand(client, command, rest);
  streams.stdout.write(printResult(result, { json: options.json }));
  return 0;
}

function isDirectExecution() {
  if (!process.argv[1]) {
    return false;
  }

  return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
}

if (isDirectExecution()) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
