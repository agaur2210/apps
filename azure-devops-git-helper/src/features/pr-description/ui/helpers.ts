export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function truncate(s: string, max: number): string {
  const first = s.split('\n')[0];
  return first.length > max ? `${first.slice(0, max)}…` : first;
}
