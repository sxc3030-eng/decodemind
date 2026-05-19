import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Tier } from '@/lib/llm/models';

export interface AppState {
  // User preferences
  tier: Tier;
  uiLanguage: 'en' | 'fr';
  strictness: 'strict' | 'standard' | 'permissive';
  setTier: (t: Tier) => void;
  setUiLanguage: (l: 'en' | 'fr') => void;
  setStrictness: (s: 'strict' | 'standard' | 'permissive') => void;

  // Engine handle (not persisted — recreated on page load)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  engine: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setEngine: (e: any | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      tier: 'quick',
      uiLanguage: 'en',
      strictness: 'standard',
      engine: null,
      setTier: (tier) => set({ tier }),
      setUiLanguage: (uiLanguage) => set({ uiLanguage }),
      setStrictness: (strictness) => set({ strictness }),
      setEngine: (engine) => set({ engine }),
    }),
    {
      name: 'decodemind-app',
      partialize: (state) => ({
        tier: state.tier,
        uiLanguage: state.uiLanguage,
        strictness: state.strictness,
      }),
    }
  )
);
