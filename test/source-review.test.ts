import assert from "node:assert/strict";
import test from "node:test";
import { sameInstant } from "../src/lib/source-review.ts";

test("sameInstant treats equivalent UTC timestamp serializations as equal", () => {
  assert.equal(sameInstant("2026-09-02T12:34:56.789Z", "2026-09-02T20:34:56.789+08:00"), true);
  assert.equal(sameInstant("2026-09-02T12:34:56.789+00:00", "2026-09-02T12:34:56.789Z"), true);
});

test("sameInstant rejects missing or invalid timestamps", () => {
  assert.equal(sameInstant(undefined, "2026-09-02T12:34:56.789Z"), false);
  assert.equal(sameInstant("not-a-date", "2026-09-02T12:34:56.789Z"), false);
  assert.equal(sameInstant("2026-09-02T12:34:56.789Z", "2026-09-02T12:34:57.789Z"), false);
});
