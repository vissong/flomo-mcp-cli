import assert from 'node:assert/strict';
import { test } from 'node:test';

import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { DEFAULT_MCP_URL, getConfigPath, readStoredConfig, resolveConfig, writeStoredConfig } from '../src/config.js';

test('resolveConfig prefers explicit options over environment', () => {
  const previousUrl = process.env.FLOMO_MCP_URL;
  const previousToken = process.env.FLOMO_MCP_TOKEN;
  process.env.FLOMO_MCP_URL = 'https://env.example/mcp';
  process.env.FLOMO_MCP_TOKEN = 'env-token';

  try {
    assert.deepEqual(resolveConfig({ url: 'https://option.example/mcp', token: 'option-token' }), {
      url: 'https://option.example/mcp',
      token: 'option-token'
    });
  } finally {
    if (previousUrl === undefined) {
      delete process.env.FLOMO_MCP_URL;
    } else {
      process.env.FLOMO_MCP_URL = previousUrl;
    }
    if (previousToken === undefined) {
      delete process.env.FLOMO_MCP_TOKEN;
    } else {
      process.env.FLOMO_MCP_TOKEN = previousToken;
    }
  }
});

test('resolveConfig defaults to flomo MCP URL', () => {
  const previousUrl = process.env.FLOMO_MCP_URL;
  delete process.env.FLOMO_MCP_URL;

  try {
    assert.equal(resolveConfig({ token: 'token' }).url, DEFAULT_MCP_URL);
  } finally {
    if (previousUrl !== undefined) {
      process.env.FLOMO_MCP_URL = previousUrl;
    }
  }
});

test('resolveConfig reads token from flomo-cli config file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flomo-cli-config-'));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousToken = process.env.FLOMO_MCP_TOKEN;
  process.env.XDG_CONFIG_HOME = dir;
  delete process.env.FLOMO_MCP_TOKEN;

  try {
    writeStoredConfig({ token: 'stored-token', url: 'https://stored.example/mcp' });
    assert.deepEqual(resolveConfig(), {
      url: 'https://stored.example/mcp',
      token: 'stored-token'
    });
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    if (previousToken === undefined) {
      delete process.env.FLOMO_MCP_TOKEN;
    } else {
      process.env.FLOMO_MCP_TOKEN = previousToken;
    }
  }
});

test('resolveConfig does not read Codex flomo MCP config as an auth fallback', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flomo-cli-empty-'));
  const fakeHome = join(dir, 'home');
  const previousHome = process.env.HOME;
  const previousXdg = process.env.XDG_CONFIG_HOME;
  const previousToken = process.env.FLOMO_MCP_TOKEN;
  process.env.HOME = fakeHome;
  process.env.XDG_CONFIG_HOME = join(dir, 'xdg');
  delete process.env.FLOMO_MCP_TOKEN;
  mkdirSync(join(fakeHome, '.codex'), { recursive: true });
  writeFileSync(join(fakeHome, '.codex', 'config.toml'), '[mcp_servers.flomo]\nbearer_token_env_var = "codex-token-that-must-not-be-used"\n');

  try {
    assert.equal(resolveConfig().token, null);
  } finally {
    if (previousHome === undefined) {
      delete process.env.HOME;
    } else {
      process.env.HOME = previousHome;
    }
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
    if (previousToken === undefined) {
      delete process.env.FLOMO_MCP_TOKEN;
    } else {
      process.env.FLOMO_MCP_TOKEN = previousToken;
    }
  }
});

test('writeStoredConfig stores token in flomo-cli config path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'flomo-cli-write-'));
  const previousXdg = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = dir;

  try {
    const path = getConfigPath();
    writeStoredConfig({ token: 'fmcp_example', url: 'https://flomoapp.com/mcp' });
    assert.deepEqual(readStoredConfig(), {
      token: 'fmcp_example',
      url: 'https://flomoapp.com/mcp'
    });
    assert.match(readFileSync(path, 'utf8'), /fmcp_example/);
  } finally {
    if (previousXdg === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = previousXdg;
    }
  }
});
