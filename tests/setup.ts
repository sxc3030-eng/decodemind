import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// RTL auto-cleanup requires `afterEach` as a global, but this project uses
// explicit imports (globals: false in vitest config). Wire it up here.
afterEach(() => cleanup());
