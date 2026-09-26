import { CommitInfo, AzureDevOpsContext, ExtensionSettings, PullRequestDescriptionGenerator } from '../../../types';
import { UI_ROOT_ID } from '../../../config';
import { fetchPRCommits } from '../../../platform/api';
import { classifyCommits } from '../../../commits/filter';
import { renderCommitList } from './commitList';
import { renderResult, renderError } from './resultView';
import { escapeHtml } from './helpers';

function cacheKey(ctx: AzureDevOpsContext): string {
  return `${ctx.organization}/${ctx.project}/${ctx.repositoryId}/${ctx.pullRequestId}`;
}

export function openPanel(
  context: AzureDevOpsContext,
  settings: ExtensionSettings,
  gen: PullRequestDescriptionGenerator,
  cache: Map<string, CommitInfo[]>
): void {
  const panel = document.createElement('div');
  panel.id = UI_ROOT_ID;
  panel.className = 'gh-ado-panel';
  panel.innerHTML = `
    <div class="gh-ado-panel-header">
      <span class="gh-ado-panel-title">PR Description Generator</span>
      <button class="gh-ado-close" title="Close">✕</button>
    </div>
    <div class="gh-ado-panel-body"></div>
  `;

  panel.querySelector('.gh-ado-close')!.addEventListener('click', () => panel.remove());
  document.body.appendChild(panel);

  const body = panel.querySelector<HTMLElement>('.gh-ado-panel-body')!;
  loadCommits(body, context, settings, gen, cache);
}

async function loadCommits(
  body: HTMLElement,
  context: AzureDevOpsContext,
  settings: ExtensionSettings,
  gen: PullRequestDescriptionGenerator,
  cache: Map<string, CommitInfo[]>
): Promise<void> {
  const key = cacheKey(context);

  if (cache.has(key)) {
    renderCommitList(body, cache.get(key)!, settings, onGenerate(body, context, gen));
    return;
  }

  body.innerHTML = `
    <div class="gh-ado-loading">
      <span class="gh-ado-spinner"></span>
      Fetching commits…
    </div>
  `;

  try {
    const raw = await fetchPRCommits(
      context.organization,
      context.project,
      context.repositoryId,
      context.pullRequestId,
      settings.patToken || undefined
    );

    if (raw.length === 0) {
      body.innerHTML = `<p class="gh-ado-empty">No commits found for this PR.</p>`;
      return;
    }

    const classified = classifyCommits(raw);
    cache.set(key, classified);
    renderCommitList(body, classified, settings, onGenerate(body, context, gen));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    body.innerHTML = `
      <div class="gh-ado-error">
        <strong>Could not load commits.</strong>
        <p>${escapeHtml(msg)}</p>
        <p>If this is a private repo, add your PAT in the extension popup.</p>
      </div>
    `;
  }
}

function onGenerate(
  body: HTMLElement,
  context: AzureDevOpsContext,
  gen: PullRequestDescriptionGenerator
) {
  return async (selected: CommitInfo[]): Promise<void> => {
    try {
      const description = await gen.generate(selected, context);
      renderResult(body, description);
    } catch (e) {
      renderError(body, escapeHtml(String(e)));
    }
  };
}
