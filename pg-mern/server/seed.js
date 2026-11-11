// Demo data: owner 9999999999 / demo12345, tenants use their phone + tenant123
import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User, Room, Bill } from "./models.js";
import dns from "node:dns";
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(","));

await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pg-manager");
if ((await User.countDocuments()) && process.env.SEED_RESET !== "1") { console.log("Database not empty. Run with SEED_RESET=1 to wipe and reseed."); process.exit(1); }
await Promise.all([User.deleteMany({}), Room.deleteMany({}), Bill.deleteMany({})]);
const hash = (p) => bcrypt.hash(p, 10);
const owner = await User.create({ name: "Sharma", phone: "9999999999", role: "owner", pgName: "Sharma PG", rate: 8, upi: "sharma@upi", password: await hash("demo12345") });
const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - 5 + i); return d.toISOString().slice(0, 7); });
const rooms = [["101", "Rohit Verma", 6500, 52], ["102", "Aman Gupta", 7000, 60], ["103", "Neha Singh", 7500, 42], ["104", "Karan Mehta", 6800, 45], ["201", "Priya Nair", 8000, 62], ["202", "Sahil Khan", 7200, 41]];
for (const [k, [number, name, rent, base]] of rooms.entries()) {
  const phone = "980000010" + (k + 1);
  const t = await User.create({ name, phone, role: "tenant", owner: owner._id, pgName: owner.pgName, password: await hash("tenant123") });
  const room = await Room.create({ owner: owner._id, number, rent, tenant: t._id, tenantName: name, phone });
  let reading = 1000;
  for (const [i, m] of months.entries()) {
    const cur = i === months.length - 1, units = Math.round(base * (cur && number === "103" ? 1.7 : 1)) + ((i * 7 + k * 3) % 7) - 3;
    const paid = !cur || k % 2 === 1, late = !cur && (i + k) % 5 === 0;
    await Bill.create({ owner: owner._id, room: room._id, month: m, rent, units, rate: 8, total: rent + units * 8, prevReading: reading, currReading: reading + units,
      status: paid ? "paid" : "pending", paidAt: paid ? new Date(`${m}-0${late ? 9 : 3}T10:00:00Z`) : undefined });
    reading += units;
  }
  room.lastReading = reading; await room.save();
}
console.log("Seeded. Owner login: 9999999999 / demo12345");
await mongoose.disconnect();
