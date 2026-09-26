import { CommitInfo, AzureDevOpsContext } from '../../../types';

// Prompt engineering lives here, separate from HTTP transport (client.ts).
// Iterate on the prompt without touching networking code, and vice versa.
export function buildRefinementPrompt(
  draft: string,
  commits: CommitInfo[],
  _context: AzureDevOpsContext
): string {
  const commitList = commits.map(c => `- ${c.message}`).join('\n');

  return `You are a technical writer refining a Pull Request description.

The template generator produced this structured draft:

${draft}

Commit messages the draft was based on:
${commitList}

Refine the draft following these rules:
- Keep all existing Markdown sections exactly (## Summary, ## Changes, ## Testing, ## Related Work Item).
- Improve sentence clarity and professional tone.
- Better combine or deduplicate bullets if any related items were missed.
- Do not invent changes that are not supported by the commits above.
- Do not add new sections.
- Output only the refined Markdown — no preamble, no explanation.`;
}
