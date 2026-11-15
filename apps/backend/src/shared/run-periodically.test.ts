import { afterEach, expect, it, vi } from 'vitest';

import { runPeriodically } from './run-periodically.js';

afterEach(() => vi.useRealTimers());

it('does not overlap runs and waits for an in-flight run when stopped', async () => {
  vi.useFakeTimers();
  let finish: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const run = vi.fn(() => pending);
  const stop = runPeriodically(run, 60_000);

  await vi.advanceTimersByTimeAsync(120_000);
  expect(run).toHaveBeenCalledTimes(1);
  const drained = vi.fn();
  const stopped = stop().then(drained);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(drained).not.toHaveBeenCalled();

  finish();
  await stopped;
  await vi.advanceTimersByTimeAsync(60_000);
  expect(drained).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledTimes(1);
});
