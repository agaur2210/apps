const STYLE_ID = 'gh-ado-styles';

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .gh-ado-fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 99999;
      display: flex; align-items: center; gap: 6px; padding: 10px 16px;
      background: #0078d4; color: #fff; border: none; border-radius: 20px;
      font-size: 13px; font-weight: 600; font-family: "Segoe UI", system-ui, sans-serif;
      cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.24);
      transition: background 0.15s, box-shadow 0.15s;
    }
    .gh-ado-fab:hover { background: #106ebe; box-shadow: 0 4px 12px rgba(0,0,0,.3); }
    .gh-ado-fab svg { flex-shrink: 0; }
    .gh-ado-panel {
      position: fixed; bottom: 70px; right: 24px; z-index: 99998;
      width: 520px; max-height: 80vh; display: flex; flex-direction: column;
      background: #fff; border: 1px solid #d0d7de; border-radius: 8px;
      box-shadow: 0 8px 32px rgba(0,0,0,.18);
      font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; color: #1f2328; overflow: hidden;
    }
    .gh-ado-panel-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; background: #f6f8fa; border-bottom: 1px solid #d0d7de;
    }
    .gh-ado-panel-title { font-weight: 600; color: #0078d4; }
    .gh-ado-close { background: none; border: none; cursor: pointer; color: #57606a; font-size: 14px; padding: 2px 6px; border-radius: 4px; }
    .gh-ado-close:hover { background: #f0f0f0; }
    .gh-ado-panel-body { overflow-y: auto; padding: 14px; flex: 1; }
    .gh-ado-loading { display: flex; align-items: center; gap: 8px; color: #57606a; }
    .gh-ado-spinner {
      width: 14px; height: 14px; border: 2px solid #d0d7de; border-top-color: #0078d4;
      border-radius: 50%; animation: gh-ado-spin 0.7s linear infinite;
    }
    @keyframes gh-ado-spin { to { transform: rotate(360deg); } }
    .gh-ado-commit-header { display: flex; align-items: baseline; gap: 8px; margin-bottom: 8px; }
    .gh-ado-commit-sub { color: #57606a; font-size: 12px; }
    .gh-ado-commit-list {
      list-style: none; margin: 0 0 12px; padding: 0;
      max-height: 220px; overflow-y: auto; border: 1px solid #d0d7de; border-radius: 6px;
    }
    .gh-ado-commit-item { border-bottom: 1px solid #f0f0f0; }
    .gh-ado-commit-item:last-child { border-bottom: none; }
    .gh-ado-commit-label { display: flex; align-items: flex-start; gap: 8px; padding: 7px 10px; cursor: pointer; user-select: none; }
    .gh-ado-commit-label:hover { background: #f6f8fa; }
    .gh-ado-commit-label input { margin-top: 2px; flex-shrink: 0; }
    .gh-ado-commit-msg { font-family: "Cascadia Code", "Consolas", monospace; font-size: 12px; }
    .gh-ado-muted { color: #8c959f; }
    .gh-ado-badge { flex-shrink: 0; font-size: 10px; padding: 1px 5px; border-radius: 10px; background: #e8f0fe; color: #0078d4; font-family: "Segoe UI", system-ui, sans-serif; }
    .gh-ado-badge-noise { background: #fff3cd; color: #856404; }
    .gh-ado-actions { margin-bottom: 4px; }
    .gh-ado-btn { display: inline-flex; align-items: center; justify-content: center; padding: 7px 16px; border: 1px solid transparent; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.12s; font-family: inherit; }
    .gh-ado-btn-primary { background: #0078d4; color: #fff; border-color: #0078d4; }
    .gh-ado-btn-primary:hover:not(:disabled) { background: #106ebe; }
    .gh-ado-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .gh-ado-btn-sm { padding: 4px 12px; font-size: 12px; background: #f6f8fa; color: #1f2328; border-color: #d0d7de; }
    .gh-ado-btn-sm:hover { background: #e9ecef; }
    .gh-ado-divider { border: none; border-top: 1px solid #d0d7de; margin: 12px 0; }
    .gh-ado-result-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .gh-ado-textarea { width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #d0d7de; border-radius: 6px; font-family: "Cascadia Code", "Consolas", monospace; font-size: 12px; resize: vertical; color: #1f2328; line-height: 1.5; }
    .gh-ado-textarea:focus { outline: none; border-color: #0078d4; box-shadow: 0 0 0 2px rgba(0,120,212,.2); }
    .gh-ado-ai-badge { font-size: 11px; padding: 2px 7px; border-radius: 10px; background: linear-gradient(135deg, #6f42c1, #0078d4); color: #fff; font-weight: 600; letter-spacing: 0.02em; }
    .gh-ado-error { color: #d1242f; }
    .gh-ado-error strong { display: block; margin-bottom: 4px; }
    .gh-ado-empty { color: #57606a; text-align: center; padding: 20px 0; }
  `;
  document.head.appendChild(style);
}

export function removeStyles(): void {
  document.getElementById(STYLE_ID)?.remove();
}
