import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Same reason as `testTimeout` in `vite.config.ts`: on a cold Windows
// filesystem a `findBy*` callback can take more than the 1 s default, and the
// failure would be reported as a missing element instead of a slow machine.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  // The app routes on the real URL, and jsdom keeps `history` between tests in
  // one file: a test that navigated would otherwise leave the next one on the
  // wrong screen.
  window.history.replaceState({}, '', '/');
});
