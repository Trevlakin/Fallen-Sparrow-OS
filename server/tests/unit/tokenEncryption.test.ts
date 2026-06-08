import { describe, expect, it } from "vitest";
import { encryptSecret, decryptSecret } from "../../src/utils/tokenEncryption.js";

describe("tokenEncryption", () => {
  it("round-trips encrypted secrets", () => {
    const plain = "refresh-token-value-123";
    const encrypted = encryptSecret(plain);
    expect(encrypted).not.toContain(plain);
    expect(decryptSecret(encrypted)).toBe(plain);
  });
});
