/** Run tasks with at most `concurrency` in flight; waits for all, results in input order. */
export async function runPool<T>(tasks: readonly (() => Promise<T>)[], concurrency: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await (tasks[i] as () => Promise<T>)() };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(concurrency)), tasks.length) }, worker));
  return results;
}
