import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import api from "./routes.js";
import dns from "node:dns";
if (process.env.DNS_SERVERS) dns.setServers(process.env.DNS_SERVERS.split(","));

if (process.env.NODE_ENV === "production" && (!process.env.MONGO_URI || (process.env.JWT_SECRET || "").length < 32)) {
  console.error("Set MONGO_URI and a JWT_SECRET of 32+ characters before starting in production.");
  process.exit(1);
}
const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_URL || "http://localhost:5173").split(",") }));
app.use(express.json({ limit: "50kb" }));
app.get("/health", (q, s) => s.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ ok: mongoose.connection.readyState === 1 }));
const lim = (limit) => rateLimit({ windowMs: 15 * 60 * 1000, limit, standardHeaders: true, legacyHeaders: false, message: { error: "Too many requests. Try again later." } });
app.use("/api/auth", lim(30));
app.use("/api", lim(600));
app.use("/api", api);
app.use((e, req, res, next) => {
  if (e.code === 11000) return res.status(409).json({ error: "Already exists (duplicate room, phone or bill)" });
  if (e.name === "CastError") return res.status(400).json({ error: "Invalid id" });
  console.error(e);
  res.status(500).json({ error: "Server error" });
});
await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/pg-manager");
await mongoose.syncIndexes();
const srv = app.listen(process.env.PORT || 5000, () => console.log("API running"));
const stop = () => srv.close(() => mongoose.disconnect().then(() => process.exit(0)));
process.on("SIGTERM", stop); process.on("SIGINT", stop);
