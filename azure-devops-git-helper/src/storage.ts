// StorageAdapter decouples settings persistence from the Chrome extension API,
// making settings testable without a browser context.

export interface StorageAdapter {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export class ChromeStorageAdapter implements StorageAdapter {
  async get(key: string): Promise<unknown> {
    return new Promise(resolve =>
      chrome.storage.local.get(key, result => resolve(result[key]))
    );
  }

  async set(key: string, value: unknown): Promise<void> {
    return new Promise(resolve =>
      chrome.storage.local.set({ [key]: value }, resolve)
    );
  }
}
