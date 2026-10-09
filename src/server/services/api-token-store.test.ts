import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createApiToken, validateApiToken, listApiTokens, revokeApiToken, hashToken, TOKEN_PREFIX } from "./api-token-store.js";
import { createUser, deleteUser } from "./user-store.js";

const PREFIX = `api-token-test-${Date.now()}`;
let userId: string;
let otherId: string;

beforeAll(async () => {
  userId = (await createUser({ email: `${PREFIX}@test.local`, password: "testpassword1", displayName: "Token User", isAuthorized: true })).id;
  otherId = (await createUser({ email: `${PREFIX}-other@test.local`, password: "testpassword1", displayName: "Other" })).id;
});

afterAll(() => {
  deleteUser(userId); // cascades to api_tokens
  deleteUser(otherId);
});

describe("api-token-store", () => {
  test("mints a prefixed token and resolves it back to the user", () => {
    const t = createApiToken(userId, "laptop");
    expect(t.token.startsWith(TOKEN_PREFIX)).toBe(true);
    expect(t.label).toBe("laptop");
    expect(t.lastUsedAt).toBeNull();
    const user = validateApiToken(t.token);
    expect(user?.id).toBe(userId);
    expect(user?.isAuthorized).toBe(true);
  });

  test("validation bumps last_used_at", () => {
    const t = createApiToken(userId, "bump");
    validateApiToken(t.token);
    const listed = listApiTokens(userId).find((x) => x.id === t.id);
    expect(listed?.lastUsedAt).not.toBeNull();
  });

  test("stores only the hash, never the plaintext", () => {
    const t = createApiToken(userId, "hash");
    const listed = listApiTokens(userId).find((x) => x.id === t.id)!;
    expect(JSON.stringify(listed)).not.toContain(t.token);
    expect(hashToken(t.token)).toHaveLength(64);
  });

  test("rejects unknown, malformed and foreign-prefix tokens", () => {
    expect(validateApiToken("dg_nope")).toBeNull();
    expect(validateApiToken("")).toBeNull();
    expect(validateApiToken("Bearer dg_x")).toBeNull();
    expect(validateApiToken("sk-not-ours")).toBeNull();
  });

  test("revoke only works for the owner and kills the token", () => {
    const t = createApiToken(userId, "revoke-me");
    expect(revokeApiToken(otherId, t.id)).toBe(false);
    expect(validateApiToken(t.token)?.id).toBe(userId);
    expect(revokeApiToken(userId, t.id)).toBe(true);
    expect(validateApiToken(t.token)).toBeNull();
    expect(revokeApiToken(userId, t.id)).toBe(false);
  });

  test("tokens of a deleted user stop validating", async () => {
    const tmp = await createUser({ email: `${PREFIX}-tmp@test.local`, password: "testpassword1", displayName: "Tmp" });
    const t = createApiToken(tmp.id, "tmp");
    deleteUser(tmp.id);
    expect(validateApiToken(t.token)).toBeNull();
  });

  test("blank label falls back to a default", () => {
    const t = createApiToken(userId, "   ");
    expect(t.label).toBe("API token");
  });
});
