import { describe, it, expect } from 'vitest';
import { MODELS, pickDefaultTier, type Tier } from '@/lib/llm/models';

describe('MODELS registry', () => {
  it('has three tiers', () => {
    expect(MODELS).toHaveProperty('quick');
    expect(MODELS).toHaveProperty('better');
    expect(MODELS).toHaveProperty('best');
  });

  it('each tier has model id, size, label', () => {
    for (const tier of ['quick', 'better', 'best'] as Tier[]) {
      const m = MODELS[tier];
      expect(typeof m.modelId).toBe('string');
      expect(typeof m.approxDiskBytes).toBe('number');
      expect(typeof m.label).toBe('string');
    }
  });

  it('best tier is Qwen 7B', () => {
    expect(MODELS.best.modelId).toBe('Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC');
  });

  it('quick tier is Qwen 1.5B', () => {
    expect(MODELS.quick.modelId).toBe('Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC');
  });
});

describe('pickDefaultTier', () => {
  it('returns quick when no adapter info', () => {
    expect(pickDefaultTier(null)).toBe('quick');
  });

  it('returns better for dGPU vendor', () => {
    expect(pickDefaultTier({ vendor: 'nvidia', architecture: 'ada' })).toBe('better');
  });

  it('returns quick for Intel iGPU', () => {
    expect(pickDefaultTier({ vendor: 'intel', architecture: 'gen-12-lp' })).toBe('quick');
  });

  it('returns better for Apple Silicon', () => {
    expect(pickDefaultTier({ vendor: 'apple', architecture: 'apple-7' })).toBe('better');
  });
});
