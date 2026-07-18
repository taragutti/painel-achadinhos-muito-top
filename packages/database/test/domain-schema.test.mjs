import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaUrl = new URL("../prisma/schema.prisma", import.meta.url);
const migrationUrl = new URL("../prisma/migrations/20260718173000_complete_domain_model/migration.sql", import.meta.url);
const messagingMigrationUrl = new URL("../prisma/migrations/20260718203000_messaging_providers/migration.sql", import.meta.url);
const queueMigrationUrl = new URL("../prisma/migrations/20260718213000_queue_scheduling/migration.sql", import.meta.url);
const queueRepositoryUrl = new URL("../src/repositories/queue-repository.ts", import.meta.url);

test("defines the complete publishing domain and required idempotency keys", async () => {
  const schema = await readFile(schemaUrl, "utf8");
  for (const model of ["User", "Product", "Publication", "Channel", "MessageTemplate", "PublishingQueue", "QueueItem", "QueueTarget", "Delivery", "Integration", "AuditLog"]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.match(schema, /currentPrice\s+Decimal\?/);
  assert.match(schema, /idempotencyKey\s+String\s+@unique/g);
  assert.match(schema, /deletedAt\s+DateTime\?/g);
});

test("uses skip-locked claims, leases and unique delivery idempotency", async () => {
  const [migration, repository] = await Promise.all([readFile(queueMigrationUrl, "utf8"), readFile(queueRepositoryUrl, "utf8")]);
  assert.match(repository, /FOR UPDATE SKIP LOCKED/); assert.match(repository, /lockedAt/); assert.match(repository, /PROCESSING.*updatedAt/s);
  assert.match(migration, /Delivery_idempotencyKey_key/); assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
});

test("keeps the messaging provider migration versioned and non-destructive", async () => {
  const migration = await readFile(messagingMigrationUrl, "utf8");
  assert.match(migration, /WAITING_QR/); assert.match(migration, /displayName/);
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
});

test("keeps the domain migration data-preserving and removes risky history cascades", async () => {
  const migration = await readFile(migrationUrl, "utf8");
  assert.doesNotMatch(migration, /DROP\s+TABLE|TRUNCATE|DELETE\s+FROM/i);
  assert.match(migration, /UPDATE "Product" SET "sourceUrl"/);
  assert.match(migration, /ON DELETE SET NULL/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/);
});
