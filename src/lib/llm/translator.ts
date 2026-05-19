import type * as webllm from '@mlc-ai/web-llm';

export interface Finding {
  ruleId: string;
  rawMessage: string;
  codeSnippet: string;
  language: string;
}

export function buildPrompt(finding: Finding, replyLanguage: 'en' | 'fr'): string {
  return [
    `SYSTEM: You are an expert who explains code bugs to non-experts.`,
    `Reply in ${replyLanguage}, max 3 sentences, no technical jargon.`,
    ``,
    `Linter: ${finding.ruleId}`,
    `Raw message: ${finding.rawMessage}`,
    `Code excerpt:`,
    '```' + finding.language,
    finding.codeSnippet,
    '```',
    ``,
    `Explain in 3 sentences:`,
    `1. What is the problem?`,
    `2. What is the impact (what could break)?`,
    `3. How do you fix it?`,
  ].join('\n');
}

export async function translateFinding(
  engine: webllm.MLCEngineInterface,
  finding: Finding,
  replyLanguage: 'en' | 'fr'
): Promise<string> {
  const prompt = buildPrompt(finding, replyLanguage);
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 200,
  });
  const content = response.choices[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}
