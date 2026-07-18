import assert from "node:assert/strict";
import test from "node:test";
import { CredentialCipher } from "../dist/index.js";
test("encrypts integration credentials with authenticated encryption", () => { const cipher = new CredentialCipher(Buffer.alloc(32, 7).toString("base64")); const encrypted = cipher.encrypt({ token: "fictitious-token", groupId: "fictitious-group" }); assert.doesNotMatch(encrypted, /fictitious-token/); assert.deepEqual(cipher.decrypt(encrypted), { token: "fictitious-token", groupId: "fictitious-group" }); });
