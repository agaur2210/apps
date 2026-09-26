import { ExtensionSettings } from './types';
import { StorageAdapter, ChromeStorageAdapter } from './storage';
import { STORAGE_KEY, DEFAULT_SETTINGS } from './config';

const chromeAdapter = new ChromeStorageAdapter();

export async function loadSettings(
  adapter: StorageAdapter = chromeAdapter
): Promise<ExtensionSettings> {
  const stored = await adapter.get(STORAGE_KEY) as Partial<ExtensionSettings> | undefined;
  return { ...DEFAULT_SETTINGS, ...stored };
}

export async function saveSettings(
  settings: ExtensionSettings,
  adapter: StorageAdapter = chromeAdapter
): Promise<void> {
  await adapter.set(STORAGE_KEY, settings);
}
