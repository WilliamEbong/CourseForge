import { describe, expect, it } from 'vitest';
import { runPool } from '../../../src/review/pool.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runPool @E1', () => {
  it('never exceeds the cap, settles all, preserves order', async () => {
    let inFlight = 0;
    let max = 0;
    const tasks = Array.from({ length: 9 }, (_, i) => async () => {
      inFlight++;
      max = Math.max(max, inFlight);
      await sleep(10 + ((i * 7) % 5) * 5);
      inFlight--;
      if (i % 3 === 0) throw new Error(`boom ${i}`);
      return i;
    });
    const out = await runPool(tasks, 3);
    expect(max).toBe(3);
    expect(out).toHaveLength(9);
    out.forEach((r, i) => {
      if (i % 3 === 0) expect(r).toMatchObject({ status: 'rejected', reason: new Error(`boom ${i}`) });
      else expect(r).toEqual({ status: 'fulfilled', value: i });
    });
  });

  it('overlaps tasks up to the cap', async () => {
    // Every task is started before any finishes; counted rather than timed so slow runners cannot flake.
    let started = 0;
    const seen: number[] = [];
    const out = await runPool(
      Array.from({ length: 5 }, (_, i) => async () => {
        started++;
        await sleep(10);
        seen.push(started);
        return i;
      }),
      5,
    );
    expect(seen).toEqual([5, 5, 5, 5, 5]);
    expect(out.map((r) => (r.status === 'fulfilled' ? r.value : -1))).toEqual([0, 1, 2, 3, 4]);
  });

  it('handles empty input and cap 1', async () => {
    expect(await runPool([], 3)).toEqual([]);
    const order: number[] = [];
    await runPool(
      [1, 2, 3].map((n) => async () => {
        order.push(n);
        await sleep(5);
      }),
      1,
    );
    expect(order).toEqual([1, 2, 3]);
  });
});
