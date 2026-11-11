import { useState } from "react";
import { api } from "./api.js";

export default function Login({ onAuth }) {
  const [reg, setReg] = useState(false), [f, setF] = useState({ name: "", pgName: "", phone: "", password: "" }), [err, setErr] = useState("");
  const on = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const go = async (e) => {
    e.preventDefault(); setErr("");
    try { const d = await api(reg ? "/auth/register" : "/auth/login", "POST", f); onAuth(d.user, d.token); }
    catch (x) { setErr(x.message); }
  };
  return (
    <form className="app card pad login" onSubmit={go}>
      <h1>🏠 PG Manager</h1>
      <p className="mut">{reg ? "Create your owner account" : "Owner or tenant login"}</p>
      {reg && <><input placeholder="Your name" value={f.name} onChange={on("name")} /><input placeholder="PG name (e.g. Sharma PG)" value={f.pgName} onChange={on("pgName")} /></>}
      <input placeholder="Phone (10 digits)" inputMode="numeric" maxLength={10} value={f.phone} onChange={on("phone")} />
      <input type="password" placeholder="Password" value={f.password} onChange={on("password")} />
      {err && <p className="err">{err}</p>}
      <button className="btn">{reg ? "Register" : "Login"}</button>
      <a onClick={() => setReg(!reg)}>{reg ? "Already have an account? Login" : "New PG owner? Register"}</a>
    </form>
  );
}
