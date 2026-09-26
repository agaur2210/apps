// Renders the editable description textarea and Copy button.
// Pure view — knows nothing about how the description was generated.
export function renderResult(body: HTMLElement, description: string): void {
  const container = body.querySelector<HTMLElement>('#gh-ado-result')!;

  container.innerHTML = `
    <hr class="gh-ado-divider" />
    <div class="gh-ado-result-header">
      <strong>Generated Description</strong>
      <button class="gh-ado-btn gh-ado-btn-sm" id="gh-ado-copy">Copy</button>
    </div>
    <textarea class="gh-ado-textarea" id="gh-ado-output" rows="18" spellcheck="false"></textarea>
  `;

  const textarea = container.querySelector<HTMLTextAreaElement>('#gh-ado-output')!;
  const copyBtn  = container.querySelector<HTMLButtonElement>('#gh-ado-copy')!;

  textarea.value = description;

  copyBtn.addEventListener('click', async () => {
    await navigator.clipboard.writeText(textarea.value).catch(() => {
      textarea.select();
      document.execCommand('copy');
    });
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy'), 2000);
  });

  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function renderError(body: HTMLElement, message: string): void {
  const container = body.querySelector<HTMLElement>('#gh-ado-result')!;
  container.innerHTML = `
    <hr class="gh-ado-divider" />
    <div class="gh-ado-error">
      <strong>Generation failed.</strong>
      <p>${message}</p>
    </div>
  `;
  container.style.display = 'block';
}
