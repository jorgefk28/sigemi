import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  // The app routes on the real URL, and jsdom keeps `history` between tests in
  // one file: a test that navigated would otherwise leave the next one on the
  // wrong screen.
  window.history.replaceState({}, '', '/');
});
