function safeParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === 'object' && !Array.isArray(input);
}

export function parseMessage(input: string): Record<string, unknown> {
  const value = safeParse(input);
  return isObject(value) ? value : { value };
}
