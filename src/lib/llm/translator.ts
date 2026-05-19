import type * as webllm from '@mlc-ai/web-llm';

export type ReplyLanguage = 'en' | 'fr';

export interface Finding {
  ruleId: string;
  rawMessage: string;
  codeSnippet: string;
  language: string;
}

export interface ChatMessage {
  role: 'system' | 'user';
  content: string;
}

export class TranslationError extends Error {
  constructor(public readonly cause: unknown) {
    super('LLM translation failed');
    this.name = 'TranslationError';
  }
}

/**
 * Build the two-message prompt: system instruction + user body.
 * WebLLM/MLCEngine treats `role: 'system'` as a real system turn; using a
 * "SYSTEM:" prefix inside a user message would not give the same behavior on
 * small quantized models like Qwen 1.5B/3B.
 */
export function buildPrompt(finding: Finding, replyLanguage: ReplyLanguage): ChatMessage[] {
  const system = `You are an expert who explains code bugs to non-experts. Reply in ${replyLanguage}, exactly 3 short sentences, no technical jargon.`;
  const user = [
    `Linter: ${finding.ruleId}`,
    `Raw message: ${finding.rawMessage}`,
    `Code excerpt:`,
    '```' + finding.language,
    finding.codeSnippet,
    '```',
    ``,
    `Answer in 3 numbered sentences:`,
    `1. What is the problem?`,
    `2. What is the impact (what could break)?`,
    `3. How do you fix it?`,
  ].join('\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ];
}

export async function translateFinding(
  engine: webllm.MLCEngineInterface,
  finding: Finding,
  replyLanguage: ReplyLanguage
): Promise<string> {
  const messages = buildPrompt(finding, replyLanguage);
  let response;
  try {
    response = await engine.chat.completions.create({
      messages,
      temperature: 0.3,
      max_tokens: 250, // 250 (not 200) — French responses run ~15-20% longer than English
    });
  } catch (err) {
    throw new TranslationError(err);
  }
  const content = response.choices[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}
