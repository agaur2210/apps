import { loadSettings, saveSettings } from '../src/settings';
import { licenseStatus } from '../src/license';

async function init(): Promise<void> {
  const settings = await loadSettings();

  const patInput          = document.getElementById('pat-token')           as HTMLInputElement;
  const mergesToggle      = document.getElementById('include-merges')      as HTMLInputElement;
  const groupToggle       = document.getElementById('group-by-category')   as HTMLInputElement;

  const licenseKeyInput   = document.getElementById('license-key')         as HTMLInputElement;
  const licenseStatusEl   = document.getElementById('license-status')      as HTMLDivElement;
  const aiLockedMsg       = document.getElementById('ai-locked-msg')       as HTMLDivElement;
  const aiSection         = document.getElementById('ai-section')          as HTMLDivElement;

  const aiEnabledToggle      = document.getElementById('ai-enabled')          as HTMLInputElement;
  const aiFields             = document.getElementById('ai-fields')            as HTMLDivElement;
  const aiProviderSelect     = document.getElementById('ai-provider')          as HTMLSelectElement;
  const aiApiKeyInput        = document.getElementById('ai-api-key')           as HTMLInputElement;
  const aiModelInput         = document.getElementById('ai-model')             as HTMLInputElement;
  const aiAzureEndpointInput = document.getElementById('ai-azure-endpoint')    as HTMLInputElement;
  const azureEndpointField   = document.getElementById('azure-endpoint-field') as HTMLDivElement;

  const saveBtn   = document.getElementById('save-btn')   as HTMLButtonElement;
  const statusMsg = document.getElementById('status-msg') as HTMLSpanElement;

  // Populate fields
  patInput.value          = settings.patToken;
  mergesToggle.checked    = settings.includeMergeCommits;
  groupToggle.checked     = settings.groupByCategory;
  licenseKeyInput.value   = settings.licenseKey;
  aiEnabledToggle.checked = settings.aiEnabled;
  aiProviderSelect.value  = settings.aiProvider;
  aiApiKeyInput.value     = settings.aiApiKey;
  aiModelInput.value      = settings.aiModel;
  aiAzureEndpointInput.value = settings.aiAzureEndpoint;

  function syncLicenseUI(): void {
    const status = licenseStatus(licenseKeyInput.value);
    const licensed = status !== 'unlicensed';

    licenseStatusEl.className = `license-status ${licensed ? (status === 'author' ? 'author' : 'valid') : 'invalid'}`;

    if (status === 'author') {
      licenseStatusEl.textContent = '★ Author license — full access';
    } else if (status === 'licensed') {
      licenseStatusEl.textContent = '✓ Licensed — AI features unlocked';
    } else {
      licenseStatusEl.textContent = '⊘ Not licensed — AI features locked';
    }

    aiLockedMsg.style.display = licensed ? 'none' : 'block';
    aiSection.style.display   = licensed ? 'block' : 'none';
  }

  function syncAIVisibility(): void {
    aiFields.classList.toggle('hidden', !aiEnabledToggle.checked);
    azureEndpointField.style.display =
      aiEnabledToggle.checked && aiProviderSelect.value === 'azure-openai' ? 'block' : 'none';
  }

  syncLicenseUI();
  syncAIVisibility();

  licenseKeyInput.addEventListener('input', syncLicenseUI);
  aiEnabledToggle.addEventListener('change', syncAIVisibility);
  aiProviderSelect.addEventListener('change', syncAIVisibility);

  saveBtn.addEventListener('click', async () => {
    await saveSettings({
      patToken:            patInput.value.trim(),
      includeMergeCommits: mergesToggle.checked,
      groupByCategory:     groupToggle.checked,
      licenseKey:          licenseKeyInput.value.trim(),
      aiEnabled:           aiEnabledToggle.checked,
      aiProvider:          aiProviderSelect.value as 'openai' | 'anthropic' | 'azure-openai',
      aiApiKey:            aiApiKeyInput.value.trim(),
      aiModel:             aiModelInput.value.trim(),
      aiAzureEndpoint:     aiAzureEndpointInput.value.trim(),
    });
    statusMsg.textContent = 'Saved ✓';
    setTimeout(() => (statusMsg.textContent = ''), 2000);
  });
}

document.addEventListener('DOMContentLoaded', init);
