import { describe, expect, it, beforeEach } from "vitest";
import { createAccessToken, sha256Hex, validateAccessToken, verifyAccessCode } from "@/lib/auth/access-code";

describe("single user access code", () => {
  beforeEach(() => {
    process.env.APP_ACCESS_CODE_HASH = `sha256:${sha256Hex("correct-code")}`;
  });

  it("verifies the correct access code hash", () => {
    expect(verifyAccessCode("correct-code")).toBe(true);
    expect(verifyAccessCode("wrong-code")).toBe(false);
  });

  it("creates and validates a signed 30-day token", () => {
    const now = Date.UTC(2026, 0, 1);
    const token = createAccessToken(now);
    expect(validateAccessToken(token, now + 1000)).toBe(true);
    expect(validateAccessToken(token, now + 31 * 24 * 60 * 60 * 1000)).toBe(false);
  });

  it("rejects tampered tokens", () => {
    const token = createAccessToken(Date.UTC(2026, 0, 1));
    expect(validateAccessToken(`${token}x`)).toBe(false);
  });
});
