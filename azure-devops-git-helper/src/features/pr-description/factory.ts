import { ExtensionSettings, PullRequestDescriptionGenerator } from '../../types';
import { CommitTemplateDescriptionGenerator } from './generator';
import { AIRefinementDecorator } from './ai/decorator';
import { AIClient } from './ai/client';
import { isLicensed } from '../../license';

export function createGenerator(settings: ExtensionSettings): PullRequestDescriptionGenerator {
  const core: PullRequestDescriptionGenerator = new CommitTemplateDescriptionGenerator();

  if (!settings.aiEnabled || !settings.aiApiKey || !isLicensed(settings.licenseKey)) {
    return core;
  }

  return new AIRefinementDecorator(core, new AIClient(settings));
}
