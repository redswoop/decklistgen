import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { createInviteCode, validateInviteCode, incrementInviteUse, listInviteCodes, deleteInviteCode } from "./invite-store.js";
import { createUser, deleteUser } from "./user-store.js";

const TEST_PREFIX = `invite-test-${Date.now()}`;
let adminId: string;

beforeAll(async () => {
  const admin = await createUser({
    email: `${TEST_PREFIX}-admin@test.com`,
    password: "testpass123",
    displayName: "Test Admin",
    isAdmin: true,
    isAuthorized: true,
  });
  adminId = admin.id;
});

afterAll(() => {
  deleteUser(adminId);
});

describe("invite codes", () => {
  test("create and validate a code", () => {
    const code = createInviteCode({
      label: "Test Group",
      isAuthorized: true,
      maxUses: null,
      createdBy: adminId,
    });

    expect(code.code).toHaveLength(8);
    expect(code.label).toBe("Test Group");
    expect(code.isAuthorized).toBe(true);
    expect(code.maxUses).toBeNull();
    expect(code.useCount).toBe(0);

    const validated = validateInviteCode(code.code);
    expect(validated).not.toBeNull();
    expect(validated!.label).toBe("Test Group");

    deleteInviteCode(code.code);
  });

  test("increment use count", () => {
    const code = createInviteCode({
      label: "Counter Test",
      isAuthorized: true,
      maxUses: null,
      createdBy: adminId,
    });

    incrementInviteUse(code.code);
    incrementInviteUse(code.code);

    const validated = validateInviteCode(code.code);
    expect(validated).not.toBeNull();
    expect(validated!.useCount).toBe(2);

    deleteInviteCode(code.code);
  });

  test("max uses enforcement", () => {
    const code = createInviteCode({
      label: "Limited",
      isAuthorized: true,
      maxUses: 2,
      createdBy: adminId,
    });

    incrementInviteUse(code.code);
    expect(validateInviteCode(code.code)).not.toBeNull();

    incrementInviteUse(code.code);
    expect(validateInviteCode(code.code)).toBeNull(); // exhausted

    deleteInviteCode(code.code);
  });

  test("invalid code returns null", () => {
    expect(validateInviteCode("NONEXISTENT")).toBeNull();
  });

  test("list codes", () => {
    const code1 = createInviteCode({ label: "List A", isAuthorized: true, maxUses: null, createdBy: adminId });
    const code2 = createInviteCode({ label: "List B", isAuthorized: false, maxUses: 10, createdBy: adminId });

    const all = listInviteCodes();
    const labels = all.map((c) => c.label);
    expect(labels).toContain("List A");
    expect(labels).toContain("List B");

    const b = all.find((c) => c.label === "List B")!;
    expect(b.isAuthorized).toBe(false);
    expect(b.maxUses).toBe(10);

    deleteInviteCode(code1.code);
    deleteInviteCode(code2.code);
  });

  test("delete code", () => {
    const code = createInviteCode({ label: "Deletable", isAuthorized: true, maxUses: null, createdBy: adminId });
    expect(deleteInviteCode(code.code)).toBe(true);
    expect(validateInviteCode(code.code)).toBeNull();
    expect(deleteInviteCode(code.code)).toBe(false); // already gone
  });
});
