import { useState } from "react";
import { api } from "./api.js";

export default function Password({ forced, onDone, onBack }) {
  const [f, setF] = useState({ current: "", next: "" }), [err, setErr] = useState("");
  const go = async (e) => {
    e.preventDefault(); setErr("");
    try { const d = await api("/auth/password", "POST", f); onDone(d.user, d.token); } catch (x) { setErr(x.message); }
  };
  return (
    <form className="app card pad login" onSubmit={go}>
      <h1>{forced ? "Set a new password" : "Change password"}</h1>
      {forced && <p className="mut">Your owner set a temporary password. Choose your own to continue.</p>}
      <input type="password" placeholder="Current password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} />
      <input type="password" placeholder="New password (8+ characters)" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
      {err && <p className="err">{err}</p>}
      <button className="btn">Save password</button>
      {!forced && <a onClick={onBack}>Cancel</a>}
    </form>
  );
}
