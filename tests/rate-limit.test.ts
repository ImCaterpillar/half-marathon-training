import { describe, expect, it, beforeEach } from "vitest";
import { clearFailures, isLocked, recordFailure, resetRateLimitForTests } from "@/lib/rate-limit";

describe("access code failure limiter", () => {
  beforeEach(() => resetRateLimitForTests());

  it("locks after too many failures", () => {
    const options = { maxFailures: 3, windowMs: 60_000, lockMs: 120_000 };
    recordFailure("ip:1", options, 0);
    recordFailure("ip:1", options, 1);
    expect(isLocked("ip:1", 2)).toBe(false);
    recordFailure("ip:1", options, 3);
    expect(isLocked("ip:1", 4)).toBe(true);
  });

  it("clears failures after successful verification", () => {
    const options = { maxFailures: 3, windowMs: 60_000, lockMs: 120_000 };
    recordFailure("ip:2", options, 0);
    clearFailures("ip:2");
    expect(isLocked("ip:2", 1)).toBe(false);
  });
});
