export type Tier = 'quick' | 'better' | 'best';

export interface ModelDescriptor {
  tier: Tier;
  modelId: string;
  approxDiskBytes: number;
  approxVramBytes: number;
  label: string;
  recommendation: string;
}

export const MODELS: Record<Tier, ModelDescriptor> = {
  quick: {
    tier: 'quick',
    modelId: 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
    approxDiskBytes: 840 * 1024 * 1024,
    approxVramBytes: 1630 * 1024 * 1024,
    label: 'Quick (1.5B)',
    recommendation: 'Default. Works on most laptops, including Intel iGPUs.',
  },
  better: {
    tier: 'better',
    modelId: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
    approxDiskBytes: 1900 * 1024 * 1024,
    approxVramBytes: 2400 * 1024 * 1024,
    label: 'Better (3B)',
    recommendation: 'Recommended for dedicated GPU or Apple Silicon.',
  },
  best: {
    tier: 'best',
    modelId: 'Qwen2.5-Coder-7B-Instruct-q4f16_1-MLC',
    approxDiskBytes: Math.round(4.1 * 1024 * 1024 * 1024),
    approxVramBytes: Math.round(5.1 * 1024 * 1024 * 1024),
    label: 'Best (7B)',
    recommendation: 'Power users only. Requires desktop GPU with >=6 GB VRAM.',
  },
};

export interface AdapterInfo {
  vendor: string;
  architecture: string;
}

export function pickDefaultTier(adapter: AdapterInfo | null): Tier {
  if (!adapter) return 'quick';
  const vendor = adapter.vendor.toLowerCase();
  if (vendor === 'intel') return 'quick';
  if (vendor === 'apple') return 'better';
  if (vendor === 'nvidia' || vendor === 'amd') return 'better';
  return 'quick';
}
