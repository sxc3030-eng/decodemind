import { describe, it, expect, vi } from 'vitest';
import {
  buildPrompt,
  translateFinding,
  TranslationError,
  type Finding,
} from '@/lib/llm/translator';

const sampleFinding: Finding = {
  ruleId: 'S605',
  rawMessage: 'Starting a process with a shell, possible injection',
  codeSnippet: 'subprocess.run(cmd, shell=True)',
  language: 'python',
};

describe('buildPrompt', () => {
  it('produces a 2-message array with system first', () => {
    const messages = buildPrompt(sampleFinding, 'en');
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('system message contains the reply language', () => {
    const messages = buildPrompt(sampleFinding, 'en');
    expect(messages[0].content).toContain('Reply in en');
  });

  it('user message contains ruleId, raw message, and code excerpt', () => {
    const messages = buildPrompt(sampleFinding, 'en');
    expect(messages[1].content).toContain('S605');
    expect(messages[1].content).toContain('shell=True');
    expect(messages[1].content).toContain('Starting a process with a shell');
  });

  it('switches reply language in the system message', () => {
    const messages = buildPrompt(sampleFinding, 'fr');
    expect(messages[0].content).toContain('Reply in fr');
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

  it('passes a 2-message system+user prompt with temperature 0.3 and max_tokens 250', async () => {
    const mockEngine = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'ok' } }],
          }),
        },
      },
    };
    await translateFinding(mockEngine as never, sampleFinding, 'en');
    const call = mockEngine.chat.completions.create.mock.calls[0][0];
    expect(call.messages).toHaveLength(2);
    expect(call.messages[0].role).toBe('system');
    expect(call.messages[1].role).toBe('user');
    expect(call.messages[1].content).toContain('S605');
    expect(call.temperature).toBe(0.3);
    expect(call.max_tokens).toBe(250);
  });

  it('returns empty string when content is null', async () => {
    const mockEngine = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: null } }],
          }),
        },
      },
    };
    const result = await translateFinding(mockEngine as never, sampleFinding, 'en');
    expect(result).toBe('');
  });

  it('wraps engine errors in TranslationError', async () => {
    const mockEngine = {
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(new Error('OOM')),
        },
      },
    };
    await expect(translateFinding(mockEngine as never, sampleFinding, 'en')).rejects.toBeInstanceOf(
      TranslationError
    );
  });
});
