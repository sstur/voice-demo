export function createId() {
  const datePart = Date.now();
  const randomPart = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
  return datePart.toString(36) + '.' + randomPart.toString(36);
}
