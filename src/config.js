import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_MCP_URL = 'https://flomoapp.com/mcp';

export function getConfigPath() {
  const baseDir = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return join(baseDir, 'flomo-cli', 'config.json');
}

export function readStoredConfig() {
  try {
    return JSON.parse(readFileSync(getConfigPath(), 'utf8'));
  } catch {
    return {};
  }
}

export function writeStoredConfig(config) {
  const path = getConfigPath();
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600);
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === 'string' && value.trim()) ?? null;
}

export function resolveConfig(options = {}) {
  const stored = readStoredConfig();

  return {
    url: firstNonEmpty(options.url, process.env.FLOMO_MCP_URL, stored.url) || DEFAULT_MCP_URL,
    token: firstNonEmpty(options.token, process.env.FLOMO_MCP_TOKEN, process.env.FLOMO_TOKEN, stored.token)
  };
}
