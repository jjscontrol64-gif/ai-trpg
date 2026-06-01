import { LocalStorageProvider } from "./local-storage";
import { StorageProvider } from "./types";

export type { SaveSnapshot, StorageProvider } from "./types";
export { SAVE_SCHEMA_VERSION, isSaveSnapshot } from "./types";

export function createStorageProvider(): StorageProvider {
  return new LocalStorageProvider();
}
