# flomo-mcp-cli

Node.js CLI wrapper for the flomo MCP HTTP endpoint.

This tool is a convenience wrapper around flomo MCP. It makes flomo MCP easier to use from a terminal, but it does not replace flomo MCP itself.

flomo MCP is a paid flomo feature. You need an active flomo Max subscription before this CLI can connect to your flomo account.

## Install

From this local checkout:

```bash
npm install -g /Users/vissong/Dev/flomo-mcp-cli
```

After publish or pushing this directory to a Git remote, the same package can be installed in one line with `npm install -g <package-or-git-url>`.

## Auth

Preferred:

```bash
flomo-cli auth login
```

Create the token yourself in the flomo App:

1. Open the flomo App sidebar.
2. Go to `flomo AI`.
3. Open `MCP 连接`.
4. Choose `个人 Token`.
5. Click `创建`, copy the token, then paste it into `flomo-cli auth login`.

Optional:

```bash
export FLOMO_MCP_TOKEN="your_flomo_mcp_token"
export FLOMO_MCP_URL="https://flomoapp.com/mcp"
```

The CLI stores `auth login` credentials in `~/.config/flomo-cli/config.json` by default, or under `$XDG_CONFIG_HOME/flomo-cli/config.json` when `XDG_CONFIG_HOME` is set.

## Commands

```bash
flomo-cli tools
flomo-cli daily-review
flomo-cli format-guide
flomo-cli tag-guide
flomo-cli search Codex --tag AI --limit 5
flomo-cli get memo_id --json
flomo-cli recommended memo_id --limit 5 --no-same-tag
flomo-cli create "#想法 hello from cli"
printf "long memo" | flomo-cli create --stdin
flomo-cli update memo_id "new content"
flomo-cli tag-search AI --limit 10
flomo-cli tag-tree 读书 --depth 2
flomo-cli tag-rename old/tag new/tag --max-memos 100
flomo-cli memory-context
flomo-cli memory-user
flomo-cli auth login
flomo-cli call memo_search --arg keywords=Codex --arg limit=3 --json
```

## Development

```bash
npm test
```

The test suite uses Node's built-in test runner and mock HTTP MCP servers. No runtime npm dependencies are required.
