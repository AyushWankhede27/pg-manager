import { useState } from "react";
import Login from "./Login.jsx";
import Owner from "./Owner.jsx";
import Tenant from "./Tenant.jsx";
import Password from "./Password.jsx";

export default function App() {
  const [u, setU] = useState(() => { try { return JSON.parse(localStorage.getItem("u")); } catch { return null; } });
  const [pw, setPw] = useState(false);
  const set = (user, token) => {
    if (user) { localStorage.setItem("u", JSON.stringify(user)); localStorage.setItem("t", token || localStorage.getItem("t")); }
    else localStorage.clear();
    setU(user);
  };
  if (!u) return <Login onAuth={set} />;
  if (u.mustChange || pw) return <Password forced={u.mustChange} onDone={(x, t) => { set(x, t); setPw(false); }} onBack={() => setPw(false)} />;
  return (
    <div className="app">
      <header>
        <div><b>🏠 {u.pgName}</b><small>{u.role === "owner" ? "Owner" : "Tenant"} · {u.name}</small></div>
        <span><button onClick={() => setPw(true)}>Password</button> <button onClick={() => set(null)}>Logout</button></span>
      </header>
      {u.role === "owner" ? <Owner onUser={set} user={u} /> : <Tenant />}
    </div>
  );
}
