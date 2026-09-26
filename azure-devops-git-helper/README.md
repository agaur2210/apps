# Git Helper for Azure DevOps

A Chrome extension that reads the commits on an Azure DevOps Pull Request and generates a clean, professional PR description from them — no copy-paste, no manual formatting.

---

## What it does

When you open any Azure DevOps Pull Request, the extension adds a **PR Description** button to the bottom-right corner of the page.

Clicking it:

1. Fetches all commits in the PR via the Azure DevOps REST API
2. Classifies each commit as meaningful, merge, or noise
3. Shows a checklist so you can include or exclude individual commits
4. Generates a structured Markdown description from the selected commits
5. Displays an editable preview — copy it directly into the PR description field

### Example

Given these commits:

```
feat: add PAT token caching
fix: refresh token when cache expires
refactor: move token generation into TokenService
test: add token expiration tests
merge develop
fix typo
```

The extension generates:

```markdown
## Summary

See changes below.

## Changes

- Added PAT token caching.
- Fixed token refresh when cached tokens expire.
- Refactored token generation into `TokenService`.
- Added tests covering token expiration.

## Testing

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual verification
```

Merge commits and noise commits (`fix typo`, `wip`, `formatting`, etc.) are filtered out automatically. You can override this in the commit checklist before generating.

---

## Installation

Install directly from the **Chrome Web Store** — no build step required:

[Add to Chrome](https://chrome.google.com/webstore/detail/git-helper-for-azure-devo)

Click **Add to Chrome** on the store page, confirm the dialog, and the extension is ready immediately.

### Build from source

If you want to modify the extension:

```bash
npm install
npm run build   # produces dist/content.js and dist/popup.js
```

Load the `azure-devops-git-helper/` folder as an unpacked extension via `chrome://extensions` → **Load unpacked**.

---

## Usage

### On an Azure DevOps PR page

1. Navigate to any Pull Request on `dev.azure.com` or `*.visualstudio.com`
2. Click the **PR Description** button (bottom-right corner)
3. The panel opens and fetches commits
4. Review the commit checklist — checked items will be included in the description
   - **merge** badge: identified as a merge commit (unchecked by default)
   - **noise** badge: identified as low-value (unchecked by default)
5. Click **Generate Description**
6. Review and edit the output in the text area
7. Click **Copy** to copy to clipboard, then paste into the PR description field
8. Click **Regenerate** to run again with different commit selections

---

## Configuration

Open the extension popup (click the toolbar icon) to configure:

| Setting | Default | Description |
|---|---|---|
| Personal Access Token (PAT) | *(blank)* | Required for private repos. Needs **Code (Read)** scope. Stored locally only. |
| Include merge commits | Off | When on, merge commits appear checked in the list by default |
| Group changes by category | On | For PRs with 6+ commits, groups bullets under headings like **Features**, **Bug Fixes**, **Refactoring** |
| License Key | *(blank)* | Required to unlock AI features. Format: `GHADO-XXXX-XXXX-XXXX` |
| Enable AI descriptions | Off | Uses an AI provider to refine the generated description (Pro feature) |
| Provider | OpenAI | OpenAI, Anthropic (Claude), or Azure OpenAI |
| API Key | *(blank)* | Your provider API key — stored locally, never sent anywhere except the chosen provider |
| Model | *(blank)* | Leave blank to use the provider default (see table below) |
| Azure OpenAI Endpoint | *(blank)* | Only shown when Azure OpenAI is selected |

### Default AI models

| Provider | Default model |
|---|---|
| OpenAI | `gpt-4o-mini` |
| Anthropic | `claude-haiku-4-5-20251001` |
| Azure OpenAI | `gpt-4o-mini` |

You can override the model in the **Model** field.

### Getting a PAT for private repos

1. Go to `dev.azure.com/{your-org}/_usersSettings/tokens`
2. Click **New Token**
3. Scope: **Code** → **Read**
4. Copy the token and paste it in the extension popup

---

## AI generation (Pro feature)

AI descriptions require a valid license key entered in the popup. Without a key, the extension uses the built-in template generator.

When AI is enabled, the extension uses a **decorator** design: the template generator always runs first, producing a structured draft, and the AI refines that draft. If the AI call fails for any reason, the template draft is returned unchanged — the feature degrades gracefully.

```
CommitTemplateDescriptionGenerator  ← always runs, produces structured draft
        │
        ▼
AIRefinementDecorator               ← only when licensed + aiEnabled + apiKey set
  sends draft + commits → AI provider
  AI refines (not replaces) the draft
  falls back to draft silently on error
        │
        ▼
Final PR description
```

This means:

- Core logic works with no license and no AI dependency
- AI is additive — it improves the output but is never required
- You can disable AI at any time without losing functionality

---

## Commit transformation rules

The extension recognises [Conventional Commits](https://www.conventionalcommits.org/) prefixes and converts them to readable sentences:

| Commit | Generated bullet |
|---|---|
| `feat: add token caching` | Added token caching. |
| `fix(auth): handle expired PAT token` | Fixed handle expired PAT token in `auth`. |
| `refactor: move token logic to TokenService` | Refactored move token logic to TokenService. |
| `test: add tests for cache expiration` | Added tests covering add tests for cache expiration. |
| `perf: reduce duplicate database calls` | Reduce duplicate database calls to improve performance. |
| `chore: update authentication configuration` | Updated update authentication configuration. |

### Filtered as noise (excluded by default)

`merge ...`, `wip`, `fix typo`, `formatting`, `minor changes`, `address comments`, `review changes`, `final fix`, `rebase`, `cleanup`, `fixup!`, `squash!`, `temp`, `checkpoint`

---

## Project structure

```
azure-devops-git-helper/
├── manifest.json               Chrome Extension Manifest V3
├── package.json
├── tsconfig.json
├── webpack.config.js           Injects build-time constants via DefinePlugin
├── .author-key.example         License key format reference (commit this)
├── .author-key                 ← gitignored — your author key goes here
│
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
│
├── popup/
│   ├── popup.html              Settings popup UI (PAT, toggles, license, AI)
│   └── popup.ts               Popup logic (load / save settings, license gating)
│
└── src/
    ├── content.ts              Entry point — mounts features, watches SPA navigation
    ├── config.ts               ← ALL tuneable values live here
    ├── types.ts                TypeScript interfaces and type definitions
    ├── settings.ts             chrome.storage read / write (StorageAdapter injected)
    ├── storage.ts              StorageAdapter interface + ChromeStorageAdapter
    ├── license.ts              License key validation; author key injected at build time
    ├── globals.d.ts            Build-time constant declarations (__AUTHOR_KEY__)
    │
    ├── platform/               Azure DevOps platform layer
    │   ├── api.ts              Fetch PR commits and details from ADO REST API
    │   └── context.ts          Parse URL + scrape PR context from page DOM
    │
    ├── commits/                Commit processing
    │   ├── parser.ts           Parse conventional commits → structured ParsedCommit
    │   └── filter.ts           Identify merge / noise commits; classify commit list
    │
    └── features/
        └── pr-description/     PR Description feature (self-contained)
            ├── index.ts        Public entry point — mount() returns unmount()
            ├── generator.ts    CommitTemplateDescriptionGenerator (core, no AI)
            ├── factory.ts      Compose core + optional AI decorator (license-gated)
            │
            ├── ai/             AI refinement (Pro)
            │   ├── prompt.ts   Build the refinement prompt (separate from transport)
            │   ├── client.ts   HTTP transport — OpenAI / Anthropic / Azure OpenAI
            │   └── decorator.ts  Wraps core generator; AI refines its output
            │
            └── ui/             Injected UI components
                ├── index.ts    mountUI() — inserts FAB, wires panel toggle, returns unmount()
                ├── fab.ts      Floating action button
                ├── panel.ts    Panel shell, commit fetch + cache, generation coordination
                ├── commitList.ts  Commit checklist with noise/merge badges
                ├── resultView.ts  Generated description textarea + Copy button
                ├── styles.ts   Inject / remove scoped CSS
                └── helpers.ts  escapeHtml(), truncate()
```

### Key design decisions

**Single config file** — all tuneable values are in `src/config.ts`. Change AI endpoints, noise patterns, grouping thresholds, or the storage key here; no other files need touching.

**`content.ts` is an orchestrator** — it mounts features and holds the `unmount()` handle. It knows nothing about DOM IDs or internal modules of any feature.

**Feature isolation** — `features/pr-description/` is fully self-contained. Adding a new feature means creating a new folder under `features/` with its own `mount() → unmount()` entry point.

**StorageAdapter injection** — `settings.ts` accepts a `StorageAdapter` parameter, defaulting to `ChromeStorageAdapter`. This makes settings logic testable without a browser context.

**Commit cache** — fetched commits are cached in a `Map` for the lifetime of the page. The cache is cleared when the feature unmounts (navigation away from the PR).

**AI as decorator** — `AIRefinementDecorator` wraps `CommitTemplateDescriptionGenerator`. The core always runs; AI only refines the draft. Failure is silent and the draft is returned as-is.

**License gating** — `factory.ts` calls `isLicensed(settings.licenseKey)` before building the AI decorator. The author bypass key is injected at build time from `.author-key` (gitignored) via webpack `DefinePlugin` — it never appears in source or git history.

---

## Development

```bash
# Watch mode — rebuilds on file save
npm run dev

# Production build
npm run build

# Type-check only (no output)
npm run type-check
```

After any code change, go to `chrome://extensions` and click the **reload** icon on the extension card. Then refresh the Azure DevOps tab.

---

## Adding a new AI provider

1. Add the provider name to the `AIProvider` union type in `src/types.ts`
2. Add the endpoint URL to `AI_ENDPOINTS` in `src/config.ts`
3. Add the default model to `AI_DEFAULT_MODELS` in `src/config.ts`
4. Add a case in `src/features/pr-description/ai/client.ts` → `refine()`
5. Add an `<option>` in `popup/popup.html`
6. Add the provider's API domain to `host_permissions` in `manifest.json`

No changes needed in `factory.ts`, `decorator.ts`, `ui/`, or `content.ts`.

---

## Supported URL formats

- `https://dev.azure.com/{organization}/{project}/_git/{repo}/pullrequest/{id}`
- `https://{organization}.visualstudio.com/{project}/_git/{repo}/pullrequest/{id}`

The extension activates automatically on PR pages and re-mounts after in-page navigation (Azure DevOps is a single-page application).

---

## Privacy

- Your PAT token, AI API key, and license key are stored in `chrome.storage.local` — local to your browser, never synced or sent to any external service by the extension itself.
- When AI is enabled, selected commit messages and PR context (title, work item ID, branch names) are sent to your configured AI provider. No source code, file contents, or repository metadata are included.
- When AI is disabled, no data leaves your browser — all processing happens locally.
