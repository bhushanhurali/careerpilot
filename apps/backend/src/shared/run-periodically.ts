export function runPeriodically(run: () => Promise<void>, intervalMs: number): () => Promise<void> {
  let running: Promise<void> | undefined;
  const tick = () => {
    if (running) return;
    running = run().finally(() => {
      running = undefined;
    });
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  tick();
  return async () => {
    clearInterval(timer);
    await running;
  };
}
