import mongoose from "mongoose";
const { Schema, model } = mongoose;
const Id = (ref) => ({ type: Schema.Types.ObjectId, ref, index: true });

export const User = model("User", new Schema({
  name: String, phone: { type: String, unique: true }, password: String,
  role: { type: String, enum: ["owner", "tenant"] }, owner: Id("User"),
  pgName: { type: String, default: "My PG" }, rate: { type: Number, default: 8 }, upi: String, mustChange: Boolean,
}, { timestamps: true }));

const roomSchema = new Schema({
  owner: Id("User"), number: String, rent: Number, tenant: Id("User"),
  tenantName: String, phone: String, lastReading: { type: Number, default: 0 },
});
roomSchema.index({ owner: 1, number: 1 }, { unique: true });
export const Room = model("Room", roomSchema);

const billSchema = new Schema({
  owner: Id("User"), room: Id("Room"), month: String, rent: Number, units: Number, rate: Number,
  total: Number, prevReading: Number, currReading: Number,
  status: { type: String, enum: ["pending", "claimed", "paid"], default: "pending" }, paidAt: Date, utr: String,
});
billSchema.index({ room: 1, month: 1 }, { unique: true });
export const Bill = model("Bill", billSchema);

export const Complaint = model("Complaint", new Schema({
  owner: Id("User"), room: Id("Room"), number: String, text: String, status: { type: String, default: "open" },
}, { timestamps: true }));
