import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';
import { timeAgo } from '@/lib/utils';

describe('foundation tests', () => {
  it('cn merges classes', () => {
    const merged = cn('a b', 'b c');
    expect(typeof merged).toBe('string');
    expect(merged.length).toBeGreaterThan(0);
  });
  it('timeAgo handles valid ISO', () => {
    const result = timeAgo(new Date(Date.now() - 300_000).toISOString());
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});
