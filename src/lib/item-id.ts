export function createItemInstanceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return `item_${globalThis.crypto.randomUUID()}`;
  }

  return `item_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
