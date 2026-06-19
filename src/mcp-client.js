const DEFAULT_PROTOCOL_VERSION = '2025-06-18';

export class McpHttpError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'McpHttpError';
    this.details = details;
  }
}

export function parseSseJsonRpc(text) {
  const dataLines = [];

  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    throw new McpHttpError('MCP response did not include an SSE data payload');
  }

  return JSON.parse(dataLines.join('\n'));
}

function parseResponseBody(text, contentType) {
  if (contentType.includes('text/event-stream')) {
    return parseSseJsonRpc(text);
  }

  if (contentType.includes('application/json')) {
    return JSON.parse(text);
  }

  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new McpHttpError(`Unsupported MCP response content type: ${contentType || 'unknown'}`);
  }
}

function normalizeToolResult(result) {
  if (!result || typeof result !== 'object') {
    return result;
  }

  if (Object.hasOwn(result, 'structuredContent')) {
    return result.structuredContent;
  }

  if (Array.isArray(result.content)) {
    const textItems = result.content
      .filter((item) => item && item.type === 'text' && typeof item.text === 'string')
      .map((item) => item.text);

    if (textItems.length === 1) {
      try {
        return JSON.parse(textItems[0]);
      } catch {
        return textItems[0];
      }
    }
  }

  return result;
}

export class McpHttpClient {
  constructor({ url, token, fetchImpl = globalThis.fetch, protocolVersion = DEFAULT_PROTOCOL_VERSION } = {}) {
    if (!url) {
      throw new McpHttpError('MCP url is required');
    }
    if (!fetchImpl) {
      throw new McpHttpError('This Node runtime does not provide fetch; use Node 20 or newer');
    }

    this.url = url;
    this.token = token;
    this.fetchImpl = fetchImpl;
    this.protocolVersion = protocolVersion;
    this.sessionId = null;
    this.nextId = 1;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    const response = await this.sendJsonRpc('initialize', {
      protocolVersion: this.protocolVersion,
      capabilities: {},
      clientInfo: {
        name: 'flomo-mcp-cli',
        version: '0.1.0'
      }
    }, { skipInitialize: true });

    this.initialized = true;
    await this.sendNotification('notifications/initialized');
    return response;
  }

  async listTools() {
    await this.initialize();
    const result = await this.sendJsonRpc('tools/list', {});
    return result.tools ?? [];
  }

  async callTool(name, args = {}) {
    await this.initialize();
    const result = await this.sendJsonRpc('tools/call', {
      name,
      arguments: args
    });
    return normalizeToolResult(result);
  }

  async sendNotification(method, params = undefined) {
    const payload = {
      jsonrpc: '2.0',
      method
    };

    if (params !== undefined) {
      payload.params = params;
    }

    await this.postJson(payload);
  }

  async sendJsonRpc(method, params = undefined, options = {}) {
    if (!options.skipInitialize && !this.initialized && method !== 'initialize') {
      await this.initialize();
    }

    const id = this.nextId++;
    const payload = {
      jsonrpc: '2.0',
      id,
      method
    };

    if (params !== undefined) {
      payload.params = params;
    }

    const response = await this.postJson(payload);
    if (!response) {
      return null;
    }

    if (response.error) {
      throw new McpHttpError(response.error.message || 'MCP JSON-RPC error', response.error);
    }

    return response.result;
  }

  async postJson(payload) {
    const headers = {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json'
    };

    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    const response = await this.fetchImpl(this.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      this.sessionId = sessionId;
    }

    const text = await response.text();
    if (!response.ok) {
      throw new McpHttpError(`MCP HTTP ${response.status}: ${text || response.statusText}`, {
        status: response.status,
        body: text
      });
    }

    return parseResponseBody(text, response.headers.get('content-type') ?? '');
  }
}
