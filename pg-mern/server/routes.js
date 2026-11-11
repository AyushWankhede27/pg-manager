import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User, Room, Bill, Complaint } from "./models.js";
import { analyze, reminderText, lateCount } from "./ai.js";

const r = Router();
const SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const h = (f) => (q, s, n) => f(q, s).catch(n);
const month = () => new Date().toISOString().slice(0, 7);
const sign = (u) => jwt.sign({ id: u._id, role: u.role }, SECRET, { expiresIn: "7d" });
const pub = (u) => ({ id: u._id, name: u.name, role: u.role, pgName: u.pgName, rate: u.rate, upi: u.upi, mustChange: !!u.mustChange });
const bad = (s, m, c = 400) => s.status(c).json({ error: m });
const auth = (role) => async (q, s, n) => {
  let p;
  try { p = jwt.verify((q.headers.authorization || "").replace("Bearer ", ""), SECRET); } catch { return bad(s, "Login required", 401); }
  if (role && p.role !== role) return bad(s, "Forbidden", 403);
  try { if (!(await User.exists({ _id: p.id }))) return bad(s, "Login required", 401); } catch (e) { return n(e); }
  q.user = p; n();
};
const phoneOk = (p) => /^\d{10}$/.test(p || "");

// ---------- Auth ----------
r.post("/auth/register", h(async (q, s) => {
  const { name, phone, password, pgName } = q.body;
  if (!name || !phoneOk(phone) || !password || password.length < 6) return bad(s, "Name, 10-digit phone and 6+ character password required");
  if (await User.findOne({ phone })) return bad(s, "Phone already registered", 409);
  const u = await User.create({ name, phone, pgName: pgName || "My PG", role: "owner", password: await bcrypt.hash(password, 10) });
  s.status(201).json({ token: sign(u), user: pub(u) });
}));
r.post("/auth/login", h(async (q, s) => {
  const u = await User.findOne({ phone: String(q.body.phone || "") });
  if (!u || !(await bcrypt.compare(String(q.body.password || ""), u.password))) return bad(s, "Wrong phone or password", 401);
  s.json({ token: sign(u), user: pub(u) });
}));
r.post("/auth/password", auth(), h(async (q, s) => {
  const u = await User.findById(q.user.id), next = String(q.body.next || "");
  if (next.length < 8) return bad(s, "New password needs 8+ characters");
  if (!(await bcrypt.compare(String(q.body.current || ""), u.password))) return bad(s, "Current password is wrong", 401);
  u.password = await bcrypt.hash(next, 10); u.mustChange = false; await u.save();
  s.json({ token: sign(u), user: pub(u) });
}));
r.patch("/settings", auth("owner"), h(async (q, s) => {
  const rate = +q.body.rate, upi = String(q.body.upi || "").trim();
  if (!(rate >= 0 && rate <= 100)) return bad(s, "Rate must be between 0 and 100");
  if (upi && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi)) return bad(s, "UPI ID looks wrong (example: name@bank)");
  s.json(pub(await User.findByIdAndUpdate(q.user.id, { rate, upi }, { new: true })));
}));

// ---------- Owner: rooms & bills ----------
r.get("/rooms", auth("owner"), h(async (q, s) => {
  const rooms = await Room.find({ owner: q.user.id }).sort("number").lean();
  const bills = await Bill.find({ owner: q.user.id, month: month() }).lean();
  s.json(rooms.map((x) => ({ ...x, bill: bills.find((b) => String(b.room) === String(x._id)) || null })));
}));
r.post("/rooms", auth("owner"), h(async (q, s) => {
  const { number, rent, tenantName, phone, password } = q.body;
  if (!number || !(+rent > 0) || !tenantName || !phoneOk(phone) || !password || password.length < 6) return bad(s, "Room no., rent, tenant name, 10-digit phone and a 6+ character password required");
  if (await User.findOne({ phone })) return bad(s, "Phone already used", 409);
  const o = await User.findById(q.user.id);
  // Owner sets the tenant's initial password and shares it with them.
  const t = await User.create({ name: tenantName, phone, role: "tenant", mustChange: true, owner: o._id, pgName: o.pgName, password: await bcrypt.hash(password, 10) });
  s.status(201).json(await Room.create({ owner: o._id, number, rent: +rent, tenant: t._id, tenantName, phone }));
}));
r.delete("/rooms/:id", auth("owner"), h(async (q, s) => {
  const room = await Room.findOneAndDelete({ _id: q.params.id, owner: q.user.id });
  if (!room) return s.sendStatus(404);
  await Promise.all([Bill.deleteMany({ room: room._id }), Complaint.deleteMany({ room: room._id }), User.findByIdAndDelete(room.tenant)]);
  s.sendStatus(204);
}));
r.post("/rooms/:id/reading", auth("owner"), h(async (q, s) => {
  const room = await Room.findOne({ _id: q.params.id, owner: q.user.id });
  if (!room) return s.sendStatus(404);
  const cur = +q.body.current, o = await User.findById(q.user.id), m = month();
  const ex = await Bill.findOne({ room: room._id, month: m });
  if (ex?.status === "paid") return bad(s, "This month's bill is already paid", 409);
  const prev = ex ? ex.prevReading : room.lastReading;
  if (!(cur >= prev)) return bad(s, `Current reading must be at least ${prev}`);
  const units = cur - prev;
  const b = await Bill.findOneAndUpdate({ room: room._id, month: m },
    { owner: room.owner, rent: room.rent, units, rate: o.rate, total: room.rent + units * o.rate, prevReading: prev, currReading: cur, $setOnInsert: { status: "pending" } },
    { upsert: true, new: true });
  room.lastReading = cur; await room.save();
  s.json(b);
}));
r.patch("/bills/:id/:act", auth("owner"), h(async (q, s) => {
  const b = await Bill.findOne({ _id: q.params.id, owner: q.user.id });
  if (!b) return s.sendStatus(404);
  if (q.params.act === "paid") { b.status = "paid"; b.paidAt = new Date(); }
  else if (q.params.act === "reject") b.status = "pending";
  else return s.sendStatus(400);
  await b.save(); s.json(b);
}));

// ---------- Complaints ----------
r.get("/complaints", auth("owner"), h(async (q, s) => s.json(await Complaint.find({ owner: q.user.id, status: "open" }).sort("-createdAt").lean())));
r.patch("/complaints/:id", auth("owner"), h(async (q, s) => {
  const c = await Complaint.findOneAndUpdate({ _id: q.params.id, owner: q.user.id }, { status: "resolved" }, { new: true });
  c ? s.json(c) : s.sendStatus(404);
}));
r.post("/complaints", auth("tenant"), h(async (q, s) => {
  const room = await Room.findOne({ tenant: q.user.id }), text = String(q.body.text || "").trim().slice(0, 300);
  if (!room || !text) return bad(s, "Complaint text required");
  s.status(201).json(await Complaint.create({ owner: room.owner, room: room._id, number: room.number, text }));
}));

// ---------- Tenant ----------
r.get("/my", auth("tenant"), h(async (q, s) => {
  const room = await Room.findOne({ tenant: q.user.id }).lean();
  if (!room) return bad(s, "No room assigned", 404);
  const [bills, complaints, o] = await Promise.all([
    Bill.find({ room: room._id }).sort("month").lean(),
    Complaint.find({ room: room._id }).sort("-createdAt").lean(),
    User.findById(room.owner),
  ]);
  s.json({ room, bills, complaints, rate: o.rate, upi: o.upi, pgName: o.pgName, insight: bills.length ? analyze(room, bills, o.rate) : null });
}));
r.post("/my/claim", auth("tenant"), h(async (q, s) => {
  const room = await Room.findOne({ tenant: q.user.id });
  const b = room && (await Bill.findOne({ room: room._id, month: month() }));
  if (!b) return bad(s, "No bill for this month yet", 404);
  if (b.status === "pending") { b.status = "claimed"; const u = String(q.body.utr || "").trim(); if (u) b.utr = u.slice(0, 30); await b.save(); }
  s.json(b);
}));

// ---------- AI ----------
r.get("/ai/insights", auth("owner"), h(async (q, s) => {
  const o = await User.findById(q.user.id);
  const [rooms, bills] = await Promise.all([Room.find({ owner: o._id }).lean(), Bill.find({ owner: o._id }).sort("month").lean()]);
  const out = rooms.map((rm) => {
    const bs = bills.filter((b) => String(b.room) === String(rm._id));
    return bs.length ? { room: rm.number, name: rm.tenantName, ...analyze(rm, bs, o.rate) } : null;
  }).filter(Boolean);
  s.json({ rooms: out, forecastTotal: out.reduce((a, x) => a + x.forecast, 0),
    chase: out.filter((x) => x.status !== "paid").sort((a, b) => b.risk - a.risk).map((x) => x.room) });
}));
r.post("/ai/reminder/:billId", auth("owner"), h(async (q, s) => {
  const b = await Bill.findOne({ _id: q.params.billId, owner: q.user.id }).lean();
  if (!b) return s.sendStatus(404);
  const [room, o, all] = await Promise.all([Room.findById(b.room).lean(), User.findById(q.user.id), Bill.find({ room: b.room }).lean()]);
  const out = await reminderText({ name: room.tenantName, pg: o.pgName, number: room.number, units: b.units, total: b.total,
    month: b.month, late: lateCount(all), tone: q.body.tone, lang: q.body.lang });
  s.json({ ...out, link: `https://wa.me/91${room.phone}?text=${encodeURIComponent(out.text)}` });
}));

export default r;
