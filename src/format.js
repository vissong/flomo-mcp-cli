export function printResult(value, { json = false } = {}) {
  if (json) {
    return `${JSON.stringify(value, null, 2)}\n`;
  }

  if (typeof value === 'string') {
    return value.endsWith('\n') ? value : `${value}\n`;
  }

  if (value && typeof value === 'object' && typeof value.content === 'string' && Object.keys(value).length === 1) {
    return `${value.content}\n`;
  }

  return `${JSON.stringify(value, null, 2)}\n`;
}
