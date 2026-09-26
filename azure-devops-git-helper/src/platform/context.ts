import { AzureDevOpsContext } from '../types';

// https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}
const DEV_AZURE_RE =
  /^https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;

// https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{id}
const VISUALSTUDIO_RE =
  /^https:\/\/([^.]+)\.visualstudio\.com\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/i;

export function isPRPage(url: string): boolean {
  return DEV_AZURE_RE.test(url) || VISUALSTUDIO_RE.test(url);
}

export function parseURLContext(
  url: string
): (Omit<AzureDevOpsContext, 'repositoryName'> & { repositoryName: string }) | null {
  let m = url.match(DEV_AZURE_RE);
  if (m) {
    return {
      organization: m[1],
      project: decodeURIComponent(m[2]),
      repositoryName: decodeURIComponent(m[3]),
      repositoryId: decodeURIComponent(m[3]),
      pullRequestId: parseInt(m[4], 10),
    };
  }

  m = url.match(VISUALSTUDIO_RE);
  if (m) {
    return {
      organization: m[1],
      project: decodeURIComponent(m[2]),
      repositoryName: decodeURIComponent(m[3]),
      repositoryId: decodeURIComponent(m[3]),
      pullRequestId: parseInt(m[4], 10),
    };
  }

  return null;
}

// Best-effort DOM scraping for PR title, work item, and branch names.
// These selectors are heuristic; ADO's DOM changes with updates.
export function scrapePageContext(): Partial<AzureDevOpsContext> {
  const ctx: Partial<AzureDevOpsContext> = {};

  const titleEl =
    document.querySelector<HTMLElement>('.repos-pr-header-title') ??
    document.querySelector<HTMLElement>('[class*="pullrequest-title"]') ??
    document.querySelector<HTMLElement>('h1[class*="title"]');
  if (titleEl?.textContent) ctx.prTitle = titleEl.textContent.trim();

  const wiEl =
    document.querySelector<HTMLElement>('[class*="work-item-id"]') ??
    document.querySelector<HTMLElement>('[aria-label*="work item"] .id') ??
    document.querySelector<HTMLElement>('[class*="workitem"] [class*="id"]');
  if (wiEl?.textContent) ctx.workItemId = wiEl.textContent.replace(/[#\s]/g, '');

  const wiTitleEl =
    document.querySelector<HTMLElement>('[class*="workitem"] [class*="title"]') ??
    document.querySelector<HTMLElement>('[class*="work-item-title"]');
  if (wiTitleEl?.textContent) ctx.workItemTitle = wiTitleEl.textContent.trim();

  const sourceEl = document.querySelector<HTMLElement>('[class*="source-ref"]');
  const targetEl = document.querySelector<HTMLElement>('[class*="target-ref"]');
  if (sourceEl?.textContent) ctx.sourceBranch = sourceEl.textContent.trim();
  if (targetEl?.textContent) ctx.targetBranch = targetEl.textContent.trim();

  return ctx;
}

export function buildContext(url: string): AzureDevOpsContext | null {
  const urlCtx = parseURLContext(url);
  if (!urlCtx) return null;
  return { ...urlCtx, ...scrapePageContext() };
}
