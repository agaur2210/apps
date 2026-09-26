import { CommitInfo } from '../types';

interface ADOCommit {
  commitId: string;
  comment: string;
  author: {
    name: string;
    date: string;
  };
}

interface ADOListResponse<T> {
  value: T[];
  count: number;
}

function buildAuthHeaders(patToken?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (patToken) {
    headers['Authorization'] = `Basic ${btoa(`:${patToken}`)}`;
  }
  return headers;
}

export async function fetchPRCommits(
  organization: string,
  project: string,
  repositoryId: string,
  pullRequestId: number,
  patToken?: string
): Promise<CommitInfo[]> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/git/repositories/${encodeURIComponent(repositoryId)}` +
    `/pullRequests/${pullRequestId}/commits?api-version=7.1`;

  const res = await fetch(url, {
    headers: buildAuthHeaders(patToken),
    credentials: patToken ? 'omit' : 'include',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Azure DevOps API error ${res.status}: ${text || res.statusText}`);
  }

  const data: ADOListResponse<ADOCommit> = await res.json();
  return (data.value ?? []).map(c => ({
    id: c.commitId,
    message: (c.comment ?? '').trim(),
    author: c.author?.name ?? '',
    date: c.author?.date ?? '',
  }));
}

export async function fetchPRDetails(
  organization: string,
  project: string,
  repositoryId: string,
  pullRequestId: number,
  patToken?: string
): Promise<{ title: string; workItemRefs?: Array<{ id: string; title?: string }> }> {
  const url =
    `https://dev.azure.com/${encodeURIComponent(organization)}` +
    `/${encodeURIComponent(project)}` +
    `/_apis/git/repositories/${encodeURIComponent(repositoryId)}` +
    `/pullRequests/${pullRequestId}?api-version=7.1`;

  const res = await fetch(url, {
    headers: buildAuthHeaders(patToken),
    credentials: patToken ? 'omit' : 'include',
  });

  if (!res.ok) return { title: '' };

  const data = await res.json();
  return {
    title: data.title ?? '',
    workItemRefs: data.workItemRefs,
  };
}
