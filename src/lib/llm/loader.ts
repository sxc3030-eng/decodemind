import * as webllm from '@mlc-ai/web-llm';
import { startTimer, type Timer } from '@/lib/measurement/instrument';
import { MODELS, type Tier } from './models';

export interface LoadProgress {
  progress: number; // 0..1
  text: string;
  timeElapsedMs: number;
}

export interface LoadResult {
  engine: webllm.MLCEngineInterface;
  loadTimer: Timer;
  tier: Tier;
}

interface WebGPUAdapter {
  requestAdapterInfo(): Promise<{ vendor?: string; architecture?: string }>;
}

interface NavigatorWithGPU extends Navigator {
  gpu: { requestAdapter(): Promise<WebGPUAdapter | null> };
}

export async function detectAdapter(): Promise<{ vendor: string; architecture: string } | null> {
  if (!('gpu' in navigator)) return null;
  try {
    const adapter = await (navigator as NavigatorWithGPU).gpu.requestAdapter();
    if (!adapter) return null;
    const info = await adapter.requestAdapterInfo();
    return { vendor: info.vendor || 'unknown', architecture: info.architecture || 'unknown' };
  } catch {
    return null;
  }
}

export async function loadModel(
  tier: Tier,
  onProgress: (p: LoadProgress) => void
): Promise<LoadResult> {
  const descriptor = MODELS[tier];
  const timer = startTimer(`load-${tier}`);

  const engine = await webllm.CreateMLCEngine(descriptor.modelId, {
    initProgressCallback: (report) => {
      onProgress({
        progress: report.progress,
        text: report.text,
        timeElapsedMs: timer.elapsedMs(),
      });
    },
  });

  return { engine, loadTimer: timer, tier };
}
