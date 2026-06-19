# flomo-mcp-cli

flomo MCP 的 Node.js 命令行封装工具。

这个工具是针对 flomo MCP 的便捷 CLI 封装，用来在终端里更方便地搜索、读取、创建和整理 flomo 笔记。它不会替代 flomo MCP，只是把 flomo MCP 暴露的能力包装成更顺手的命令。

注意：flomo MCP 是 flomo 的付费功能。使用本工具前，需要先购买 flomo Max 订阅，并在 flomo App 中创建个人 Token。

## 安装

```bash
npm install -g https://github.com/vissong/flomo-mcp-cli.git
```

安装后会得到 `flomo-cli` 命令。

## 认证

推荐使用交互式登录：

```bash
flomo-cli auth login
```

请先在 flomo App 中手动创建个人 Token：

1. 打开 flomo App 侧边栏。
2. 进入 `flomo AI`。
3. 打开 `MCP 连接`。
4. 选择 `个人 Token`。
5. 点击 `创建`，复制 Token。
6. 回到终端，运行 `flomo-cli auth login` 并粘贴 Token。

也可以用环境变量：

```bash
export FLOMO_MCP_TOKEN="your_flomo_mcp_token"
export FLOMO_MCP_URL="https://flomoapp.com/mcp"
```

`auth login` 默认会把凭据保存到 `~/.config/flomo-cli/config.json`。如果设置了 `XDG_CONFIG_HOME`，则保存到 `$XDG_CONFIG_HOME/flomo-cli/config.json`。

## 常用命令

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

## 开发

```bash
npm test
```

测试使用 Node.js 内置 test runner 和本地 mock MCP HTTP server。本项目没有运行时 npm 依赖。

---

## English

`flomo-mcp-cli` is a Node.js command-line wrapper for flomo MCP.

It makes flomo MCP easier to use from a terminal by wrapping MCP capabilities such as searching, reading, creating, and organizing memos into simple CLI commands. It does not replace flomo MCP itself.

Important: flomo MCP is a paid flomo feature. You need an active flomo Max subscription before this CLI can connect to your flomo account. You also need to create a personal Token in the flomo App.

## Install

```bash
npm install -g https://github.com/vissong/flomo-mcp-cli.git
```

This installs the `flomo-cli` command.

## Auth

Recommended:

```bash
flomo-cli auth login
```

Create the personal Token in the flomo App first:

1. Open the flomo App sidebar.
2. Go to `flomo AI`.
3. Open `MCP 连接`.
4. Choose `个人 Token`.
5. Click `创建`, copy the Token.
6. Return to your terminal, run `flomo-cli auth login`, and paste the Token.

Optional environment variables:

```bash
export FLOMO_MCP_TOKEN="your_flomo_mcp_token"
export FLOMO_MCP_URL="https://flomoapp.com/mcp"
```

By default, `auth login` stores credentials at `~/.config/flomo-cli/config.json`. When `XDG_CONFIG_HOME` is set, it stores them at `$XDG_CONFIG_HOME/flomo-cli/config.json`.

## Commands

```bash
flomo-cli tools
flomo-cli daily-review
flomo-cli format-guide
flomo-cli tag-guide
flomo-cli search Codex --tag AI --limit 5
flomo-cli get memo_id --json
flomo-cli recommended memo_id --limit 5 --no-same-tag
flomo-cli create "#idea hello from cli"
printf "long memo" | flomo-cli create --stdin
flomo-cli update memo_id "new content"
flomo-cli tag-search AI --limit 10
flomo-cli tag-tree reading --depth 2
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

The test suite uses Node.js built-in test runner and local mock MCP HTTP servers. The package has no runtime npm dependencies.
