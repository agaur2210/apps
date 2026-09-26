import { CommitInfo, ExtensionSettings } from '../../../types';
import { COMMIT_MSG_TRUNCATE } from '../../../config';
import { escapeHtml, truncate } from './helpers';

// Renders the commit checklist and Generate button.
// Fires onGenerate with the selected commits — knows nothing about generation logic.
export function renderCommitList(
  body: HTMLElement,
  commits: CommitInfo[],
  settings: ExtensionSettings,
  onGenerate: (selected: CommitInfo[]) => Promise<void>
): void {
  const noisy = commits.filter(c => c.isNoise || (c.isMerge && !settings.includeMergeCommits));
  const useful = commits.filter(c => !c.isNoise && (!c.isMerge || settings.includeMergeCommits));
  const allCommits = [...useful, ...noisy];

  const aiLabel = settings.aiEnabled && settings.aiApiKey
    ? `<span class="gh-ado-ai-badge">✦ AI · ${settings.aiProvider}</span>`
    : '';

  body.innerHTML = `
    <div class="gh-ado-commit-header">
      <strong>Commits detected: ${commits.length}</strong>
      <span class="gh-ado-commit-sub">${noisy.length} filtered as noise</span>
      ${aiLabel}
    </div>
    <ul class="gh-ado-commit-list" id="gh-ado-commit-list"></ul>
    <div class="gh-ado-actions">
      <button class="gh-ado-btn gh-ado-btn-primary" id="gh-ado-generate">Generate Description</button>
    </div>
    <div id="gh-ado-result" style="display:none"></div>
  `;

  const list = body.querySelector<HTMLUListElement>('#gh-ado-commit-list')!;

  allCommits.forEach((commit, idx) => {
    const checked = !commit.isNoise && (!commit.isMerge || settings.includeMergeCommits);
    const li = document.createElement('li');
    li.className = 'gh-ado-commit-item';
    li.innerHTML = `
      <label class="gh-ado-commit-label">
        <input type="checkbox" data-idx="${idx}" ${checked ? 'checked' : ''} />
        <span class="gh-ado-commit-msg ${commit.isNoise || commit.isMerge ? 'gh-ado-muted' : ''}">
          ${escapeHtml(truncate(commit.message, COMMIT_MSG_TRUNCATE))}
        </span>
        ${commit.isMerge ? '<span class="gh-ado-badge">merge</span>' : ''}
        ${commit.isNoise ? '<span class="gh-ado-badge gh-ado-badge-noise">noise</span>' : ''}
      </label>
    `;
    list.appendChild(li);
  });

  const generateBtn = body.querySelector<HTMLButtonElement>('#gh-ado-generate')!;

  generateBtn.addEventListener('click', async () => {
    const selected = Array.from(
      body.querySelectorAll<HTMLInputElement>('input[type=checkbox]:checked')
    ).map(cb => allCommits[parseInt(cb.dataset.idx!, 10)]);

    if (selected.length === 0) {
      alert('Select at least one commit.');
      return;
    }

    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating…';

    try {
      await onGenerate(selected);
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = 'Regenerate';
    }
  });
}
