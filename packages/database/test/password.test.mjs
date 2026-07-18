import assert from "node:assert/strict";
import test from "node:test";
import { hashPassword, verifyPassword } from "../dist/auth.js";

test("hashes passwords with a unique salt and verifies them safely", async () => {
  const password = "fictitious-password-123";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("incorrect-password-123", first), false);
  assert.doesNotMatch(first, new RegExp(password));
});
