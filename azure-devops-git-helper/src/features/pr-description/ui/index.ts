import { CommitInfo, AzureDevOpsContext, ExtensionSettings, PullRequestDescriptionGenerator } from '../../../types';
import { UI_ROOT_ID, UI_FAB_ID } from '../../../config';
import { injectStyles, removeStyles } from './styles';
import { createFAB } from './fab';
import { openPanel } from './panel';

// Mounts the FAB button and wires up the panel toggle.
// Returns an unmount function — callers never touch DOM IDs directly.
export function mountUI(
  context: AzureDevOpsContext,
  settings: ExtensionSettings,
  gen: PullRequestDescriptionGenerator
): () => void {
  injectStyles();

  // Page-lifetime commit cache — cleared on unmount (navigation away from PR)
  const cache = new Map<string, CommitInfo[]>();

  const fab = createFAB();
  document.body.appendChild(fab);

  fab.addEventListener('click', () => {
    const existing = document.getElementById(UI_ROOT_ID);
    if (existing) {
      existing.remove();
    } else {
      openPanel(context, settings, gen, cache);
    }
  });

  return () => {
    document.getElementById(UI_ROOT_ID)?.remove();
    document.getElementById(UI_FAB_ID)?.remove();
    removeStyles();
    cache.clear();
  };
}
