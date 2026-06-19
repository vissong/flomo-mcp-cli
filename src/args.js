export function parseFlagValue(argv, index, name) {
  const current = argv[index];
  const inlinePrefix = `${name}=`;

  if (current.startsWith(inlinePrefix)) {
    return { value: current.slice(inlinePrefix.length), consumed: 1 };
  }

  if (index + 1 >= argv.length || argv[index + 1].startsWith('--')) {
    throw new Error(`${name} requires a value`);
  }

  return { value: argv[index + 1], consumed: 2 };
}

export function parseBoolean(value, label) {
  if (value === true || value === 'true' || value === '1' || value === 'yes') {
    return true;
  }
  if (value === false || value === 'false' || value === '0' || value === 'no') {
    return false;
  }
  throw new Error(`${label} must be true or false`);
}

export function parseInteger(value, label) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== String(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return parsed;
}

export function parseKeyValue(value) {
  const index = value.indexOf('=');
  if (index <= 0) {
    throw new Error('--arg expects key=value');
  }

  const key = value.slice(0, index);
  const rawValue = value.slice(index + 1);
  try {
    return [key, JSON.parse(rawValue)];
  } catch {
    return [key, rawValue];
  }
}
