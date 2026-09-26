import { UI_FAB_ID } from '../../../config';

export function createFAB(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.id = UI_FAB_ID;
  btn.className = 'gh-ado-fab';
  btn.title = 'Git Helper – Generate PR Description';

  const img = document.createElement('img');
  img.src = chrome.runtime.getURL('icons/icon48.png');
  img.width = 18;
  img.height = 18;
  img.alt = '';

  const label = document.createElement('span');
  label.textContent = 'PR Description';

  btn.appendChild(img);
  btn.appendChild(label);
  return btn;
}
