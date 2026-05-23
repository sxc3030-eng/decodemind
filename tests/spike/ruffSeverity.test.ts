import { describe, it, expect } from 'vitest';
import { ruffSeverity } from '@/spike/folderScan';

describe('ruffSeverity', () => {
  it('maps S* (security) to error', () => {
    expect(ruffSeverity('S605')).toBe('error');
    expect(ruffSeverity('S101')).toBe('error');
  });

  it('maps F* (pyflakes — real bugs) to error', () => {
    expect(ruffSeverity('F841')).toBe('error'); // unused variable
    expect(ruffSeverity('F401')).toBe('error'); // unused import
  });

  it('maps B* (bugbear) and ASYNC* to warning', () => {
    expect(ruffSeverity('B006')).toBe('warning');
    expect(ruffSeverity('ASYNC100')).toBe('warning');
  });

  it('maps W* (warnings) to warning', () => {
    expect(ruffSeverity('W605')).toBe('warning');
  });

  it('maps E* (style) to info — not error', () => {
    expect(ruffSeverity('E501')).toBe('info'); // line too long — NOT critical
    expect(ruffSeverity('E711')).toBe('info');
  });

  it('maps UP* (modernisation) to info', () => {
    expect(ruffSeverity('UP045')).toBe('info');
    expect(ruffSeverity('UP006')).toBe('info');
  });

  it('maps C9* (complexity), N* (naming), ANN* to info', () => {
    expect(ruffSeverity('C901')).toBe('info');
    expect(ruffSeverity('N802')).toBe('info');
    expect(ruffSeverity('ANN001')).toBe('info');
  });

  it('falls back to warning for unknown prefix', () => {
    expect(ruffSeverity('XYZ123')).toBe('warning');
  });

  it('handles null code', () => {
    expect(ruffSeverity(null)).toBe('warning');
  });
});
