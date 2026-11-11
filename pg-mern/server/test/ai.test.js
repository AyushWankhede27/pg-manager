import test from "node:test";
import assert from "node:assert/strict";
import { analyze, lateCount } from "../ai.js";

const b = (month, units, status = "paid", paidAt) => ({ month, units, status, paidAt });
const steady = [b("2026-06", 40), b("2026-07", 42), b("2026-08", 41), b("2026-09", 43), b("2026-10", 42)];

test("flags a usage spike against the room's own history", () => {
  const a = analyze({ rent: 7500 }, [...steady, b("2026-11", 72, "pending")], 8);
  assert.equal(a.anomaly, true);
  assert.equal(a.avg, 42);
  assert.ok(a.pct > 60);
});
test("does not flag normal usage", () => {
  assert.equal(analyze({ rent: 7500 }, [...steady, b("2026-11", 44, "pending")], 8).anomaly, false);
});
test("needs enough history before flagging", () => {
  assert.equal(analyze({ rent: 7500 }, [b("2026-10", 40), b("2026-11", 90, "pending")], 8).anomaly, false);
});
test("forecast = rent + rate x average of last 3 months and current", () => {
  assert.equal(analyze({ rent: 7500 }, [...steady, b("2026-11", 72, "pending")], 8).forecast, 7896);
});
test("lateCount: unpaid past bills and payments after the 5th", () => {
  const bs = [b("2020-01", 40, "pending"), b("2020-02", 40, "paid", new Date("2020-02-09T12:00:00Z")), b("2020-03", 40, "paid", new Date("2020-03-02T12:00:00Z"))];
  assert.equal(lateCount(bs), 2);
});
