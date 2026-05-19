import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, translateFinding, type Finding } from '@/lib/llm/translator';

const sampleFinding: Finding = {
  ruleId: 'S605',
  rawMessage: 'Starting a process with a shell, possible injection',
  codeSnippet: 'subprocess.run(cmd, shell=True)',
  language: 'python',
};

describe('buildPrompt', () => {
  it('includes ruleId and message and snippet', () => {
    const prompt = buildPrompt(sampleFinding, 'en');
    expect(prompt).toContain('S605');
    expect(prompt).toContain('shell=True');
    expect(prompt).toContain('Reply in en');
  });

  it('switches language', () => {
    const prompt = buildPrompt(sampleFinding, 'fr');
    expect(prompt).toContain('Reply in fr');
  });
});

describe('translateFinding', () => {
  it('returns the engine response content', async () => {
    const mockEngine = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'This is a shell injection risk.' } }],
          }),
        },
      },
    };

    const result = await translateFinding(mockEngine as never, sampleFinding, 'en');
    expect(result).toBe('This is a shell injection risk.');
    expect(mockEngine.chat.completions.create).toHaveBeenCalledOnce();
  });
});
