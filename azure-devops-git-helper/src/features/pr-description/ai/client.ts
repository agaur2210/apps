import { CommitInfo, AzureDevOpsContext, ExtensionSettings } from '../../../types';
import {
  AI_ENDPOINTS,
  AI_DEFAULT_MODELS,
  AI_TEMPERATURE,
  AI_MAX_TOKENS,
  AI_AZURE_API_VERSION,
} from '../../../config';
import { buildRefinementPrompt } from './prompt';

export class AIClient {
  private readonly model: string;

  constructor(private readonly settings: ExtensionSettings) {
    this.model = settings.aiModel || AI_DEFAULT_MODELS[settings.aiProvider];
  }

  async refine(draft: string, commits: CommitInfo[], context: AzureDevOpsContext): Promise<string> {
    const prompt = buildRefinementPrompt(draft, commits, context);
    switch (this.settings.aiProvider) {
      case 'anthropic':    return this.callAnthropic(prompt);
      case 'azure-openai': return this.callAzureOpenAI(prompt);
      default:             return this.callOpenAI(prompt);
    }
  }

  private async callOpenAI(prompt: string): Promise<string> {
    const res = await fetch(AI_ENDPOINTS.openai, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.settings.aiApiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: 'user', content: prompt }], temperature: AI_TEMPERATURE, max_tokens: AI_MAX_TOKENS }),
    });
    if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }

  private async callAnthropic(prompt: string): Promise<string> {
    const res = await fetch(AI_ENDPOINTS.anthropic, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.settings.aiApiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: this.model, max_tokens: AI_MAX_TOKENS, messages: [{ role: 'user', content: prompt }] }),
    });
    if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
    const data = await res.json();
    return data.content?.[0]?.text?.trim() ?? '';
  }

  private async callAzureOpenAI(prompt: string): Promise<string> {
    const endpoint = this.settings.aiAzureEndpoint;
    if (!endpoint) throw new Error('Azure OpenAI endpoint is required');
    const url = `${endpoint.replace(/\/$/, '')}/openai/deployments/${this.model}/chat/completions?api-version=${AI_AZURE_API_VERSION}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': this.settings.aiApiKey },
      body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], temperature: AI_TEMPERATURE, max_tokens: AI_MAX_TOKENS }),
    });
    if (!res.ok) throw new Error(`Azure OpenAI HTTP ${res.status}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() ?? '';
  }
}
