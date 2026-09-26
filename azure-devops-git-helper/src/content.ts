import { isPRPage, buildContext } from './platform/context';
import { loadSettings } from './settings';
import { NAV_DEBOUNCE_MS } from './config';
import { mount as mountPRDescription } from './features/pr-description';

let currentUrl = window.location.href;
let unmount: (() => void) | null = null;

async function tryMount(): Promise<void> {
  if (!isPRPage(window.location.href)) return;

  const context = buildContext(window.location.href);
  if (!context) return;

  const settings = await loadSettings();

  // Mount features — add future features here, each returns its own unmount
  unmount = mountPRDescription(context, settings);
}

function watchNavigation(): void {
  const handleChange = () => {
    if (window.location.href === currentUrl) return;
    currentUrl = window.location.href;
    unmount?.();
    unmount = null;
    setTimeout(tryMount, NAV_DEBOUNCE_MS);
  };

  window.addEventListener('popstate', handleChange);
  window.addEventListener('hashchange', handleChange);

  // Catches SPA navigations that don't fire popstate
  const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) handleChange();
  });
  observer.observe(document.body, { childList: true, subtree: false });
}

tryMount();
watchNavigation();
