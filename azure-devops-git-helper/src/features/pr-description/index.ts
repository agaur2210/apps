import { AzureDevOpsContext, ExtensionSettings } from '../../types';
import { createGenerator } from './factory';
import { mountUI } from './ui/index';

// Single entry point for the PR Description feature.
// Returns unmount() — content.ts never touches DOM IDs or internal modules.
export function mount(context: AzureDevOpsContext, settings: ExtensionSettings): () => void {
  const gen = createGenerator(settings);
  return mountUI(context, settings, gen);
}
