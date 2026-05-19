import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/appStore';

describe('appStore', () => {
  beforeEach(() => {
    // Reset to defaults before each test
    useAppStore.setState({
      tier: 'quick',
      uiLanguage: 'en',
      strictness: 'standard',
      engine: null,
    });
  });

  it('defaults', () => {
    const s = useAppStore.getState();
    expect(s.tier).toBe('quick');
    expect(s.uiLanguage).toBe('en');
    expect(s.strictness).toBe('standard');
    expect(s.engine).toBeNull();
  });

  it('setters update state', () => {
    useAppStore.getState().setTier('best');
    expect(useAppStore.getState().tier).toBe('best');
    useAppStore.getState().setUiLanguage('fr');
    expect(useAppStore.getState().uiLanguage).toBe('fr');
    useAppStore.getState().setStrictness('strict');
    expect(useAppStore.getState().strictness).toBe('strict');
  });
});
