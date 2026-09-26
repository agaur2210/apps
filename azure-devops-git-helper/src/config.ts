// ─────────────────────────────────────────────────────────────────────────────
// config.ts — single source of truth for all tuneable values.
//
// Change behaviour here; never scatter magic literals across source files.
// ─────────────────────────────────────────────────────────────────────────────

import { AIProvider, ExtensionSettings } from './types';

// ── Storage ───────────────────────────────────────────────────────────────────

export const STORAGE_KEY = 'git_helper_settings';

// ── Default user settings (shown / saved in the popup) ───────────────────────

export const DEFAULT_SETTINGS: ExtensionSettings = {
  // Commit filtering
  includeMergeCommits: false,

  // Description formatting
  groupByCategory: true,

  // Azure DevOps auth
  patToken: '',

  // Pro license key — required to unlock AI features
  licenseKey: '',

  // AI generation — disabled by default; uses template generator when off
  aiEnabled: false,
  aiProvider: 'openai',
  aiApiKey: '',
  aiModel: '',           // blank = use provider default (see AI_DEFAULT_MODELS)
  aiAzureEndpoint: '',   // only used when aiProvider === 'azure-openai'
};

// ── AI provider endpoints ─────────────────────────────────────────────────────

export const AI_ENDPOINTS: Record<Exclude<AIProvider, 'azure-openai'>, string> = {
  openai:    'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  // azure-openai endpoint is user-supplied (aiAzureEndpoint setting)
};

export const AI_DEFAULT_MODELS: Record<AIProvider, string> = {
  openai:        'gpt-4o-mini',
  anthropic:     'claude-haiku-4-5-20251001',
  'azure-openai': 'gpt-4o-mini',
};

export const AI_TEMPERATURE       = 0.2;
export const AI_MAX_TOKENS        = 1024;
export const AI_AZURE_API_VERSION = '2024-02-01';

// ── Description generator ─────────────────────────────────────────────────────

// Minimum meaningful commits in a PR before switching to grouped category headings.
export const GROUP_THRESHOLD = 6;

// Display order of category headings in grouped mode.
export const CATEGORY_ORDER: readonly string[] = [
  'Features',
  'Bug Fixes',
  'Performance',
  'Refactoring',
  'Testing',
  'Documentation',
  'Build & CI',
  'Other Changes',
];

// Maps conventional commit types to display category names.
export const TYPE_TO_CATEGORY: Record<string, string> = {
  feat:     'Features',
  fix:      'Bug Fixes',
  perf:     'Performance',
  refactor: 'Refactoring',
  test:     'Testing',
  docs:     'Documentation',
  build:    'Build & CI',
  ci:       'Build & CI',
  chore:    'Other Changes',
  style:    'Other Changes',
  unknown:  'Other Changes',
};

// ── Commit filtering ──────────────────────────────────────────────────────────

export const MERGE_PATTERNS: RegExp[] = [
  /^merge\b/i,
  /^merged?\s+branch\b/i,
  /^merged?\s+pull\s+request\b/i,
  /^merged?\s+(develop|main|master|release)\b/i,
  /^pull\s+request\s+#\d+/i,
];

// Commits that represent implementation noise, not meaningful logical changes.
export const NOISE_PATTERNS: RegExp[] = [
  /^wip\b/i,
  /^work\s+in\s+progress\b/i,
  /^fix\s+typo/i,
  /^typo\b/i,
  /^formatting\b/i,
  /^format\b/i,
  /^minor\s+(changes?|fixes?|updates?|tweaks?)\b/i,
  /^address\s+(review\s+)?comments?\b/i,
  /^review\s+(changes?|feedback|comments?)\b/i,
  /^final\s+fix\b/i,
  /^rebase\b/i,
  /^cleanup\b/i,
  /^clean\s+up\b/i,
  /^fixup[!]?\s+/i,
  /^squash[!]?\s+/i,
  /^temp\b/i,
  /^temporary\b/i,
  /^checkpoint\b/i,
  /^snapshot\b/i,
  /^update\s+snapshot/i,
];

// ── UI ────────────────────────────────────────────────────────────────────────

// Max characters to show per commit message in the selection list.
export const COMMIT_MSG_TRUNCATE = 90;

// Milliseconds to wait after an SPA navigation before attempting to mount the
// UI (gives Azure DevOps time to finish rendering the PR page).
export const NAV_DEBOUNCE_MS = 800;

// Stable DOM IDs used by the injected panel and FAB button.
export const UI_ROOT_ID = 'gh-ado-root';
export const UI_FAB_ID  = 'gh-ado-fab';
