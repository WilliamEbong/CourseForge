import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts', 'components/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    // Low-RAM friendly default; the machine this was built on had ~2 GB free.
    maxWorkers: 3,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { COURSEFORGE_TEST: '1' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'components/course-ui/src/**/*.ts'],
      exclude: ['**/*.stories.ts'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { lines: 70 },
    },
  },
});
