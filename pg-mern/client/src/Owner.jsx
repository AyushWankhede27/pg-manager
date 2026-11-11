import { useEffect, useState } from "react";
import { api, inr } from "./api.js";

const empty = { number: "", rent: "", tenantName: "", phone: "", password: "" };
export default function Owner({ user, onUser }) {
  const [rooms, setRooms] = useState([]), [ai, setAi] = useState(null), [cs, setCs] = useState([]);
  const [err, setErr] = useState(""), [rem, setRem] = useState(null), [f, setF] = useState(empty), [rd, setRd] = useState({}), [cfg, setCfg] = useState({ rate: user.rate, upi: user.upi || "" });

  const load = async () => {
    try { const [a, b, c] = await Promise.all([api("/rooms"), api("/ai/insights"), api("/complaints")]); setRooms(a); setAi(b); setCs(c); }
    catch (e) { setErr(e.message); }
  };
  useEffect(() => { load(); }, []);
  const run = (fn) => async () => { setErr(""); try { await fn(); await load(); } catch (e) { setErr(e.message); } };
  const st = (r) => r.bill?.status;
  const due = rooms.filter((r) => r.bill && st(r) !== "paid").length;

  return (
    <>
      {err && <p className="err">{err}</p>}
      <div className="stats">
        <div><b>{due}</b><span>Rent baaki</span></div><div><b>{rooms.length}</b><span>Rooms</span></div>
        <div><b>{rooms.filter((r) => st(r) === "paid").length}</b><span>Paid</span></div>
      </div>

      <h2>AI Insights</h2>
      <div className="card ai">
        {ai?.rooms.filter((x) => x.anomaly).map((x) => <p key={x.room} className="warn">⚡ Room {x.room}: {x.units} units, {x.pct}% above usual ({x.avg}). Possible extra {inr(x.extra)}. Check AC/heater/meter.</p>)}
        {ai?.chase.length > 0 && <p>🎯 Chase first: <b>{ai.chase.slice(0, 3).join(" → ")}</b> (ranked by late history)</p>}
        <p>📈 Forecast next month: <b>{inr(ai?.forecastTotal)}</b></p>
      </div>

      {cs.length > 0 && <><h2>Complaints</h2><div className="card">{cs.map((c) => (
        <div className="row" key={c._id}><span className="rn">{c.number}</span><div className="who">{c.text}</div>
          <button className="sm" onClick={run(() => api("/complaints/" + c._id, "PATCH"))}>Done ✓</button></div>))}</div></>}

      <h2>Rooms · {new Date().toISOString().slice(0, 7)}</h2>
      <div className="card">
        {rooms.map((r) => (
          <div className="room" key={r._id}>
            <div className="row">
              <span className="rn">{r.number}</span>
              <div className="who"><b>{r.tenantName}</b><small>{r.bill ? `${r.bill.units} units · ${inr(r.bill.total)}${r.bill.utr ? ` · UTR ${r.bill.utr}` : ""}` : `Rent ${inr(r.rent)} · no reading yet`}</small></div>
              <span className={"badge " + (st(r) === "paid" ? "p" : "b")}>{st(r) === "paid" ? "Paid ✓" : st(r) === "claimed" ? "Claimed" : r.bill ? "Baaki" : "—"}</span>
            </div>
            <div className="acts">
              <input type="number" placeholder={`Reading (last ${r.bill ? r.bill.prevReading : r.lastReading})`} value={rd[r._id] || ""} onChange={(e) => setRd({ ...rd, [r._id]: e.target.value })} />
              <button className="sm" onClick={run(async () => { await api(`/rooms/${r._id}/reading`, "POST", { current: rd[r._id] }); setRd({ ...rd, [r._id]: "" }); })}>Save</button>
              {r.bill && st(r) !== "paid" && <button className="sm g" onClick={run(() => api(`/bills/${r.bill._id}/paid`, "PATCH"))}>Mark paid</button>}
              {st(r) === "claimed" && <button className="sm" onClick={run(() => api(`/bills/${r.bill._id}/reject`, "PATCH"))}>Reject</button>}
              {r.bill && st(r) !== "paid" && <button className="sm wa" onClick={run(async () => setRem(await api("/ai/reminder/" + r.bill._id, "POST", { tone: "auto" })))}>💬 Remind</button>}
              <button className="sm x" onClick={() => confirm(`Remove room ${r.number} and its data?`) && run(() => api("/rooms/" + r._id, "DELETE"))()}>🗑</button>
            </div>
          </div>
        ))}
        {!rooms.length && <p className="pad mut">Koi room nahi. Neeche se add karo.</p>}
      </div>

            <h2>Settings</h2>
      <div className="card pad">
        <input type="number" placeholder="Bijli rate ₹/unit" value={cfg.rate} onChange={(e) => setCfg({ ...cfg, rate: e.target.value })} />
        <input placeholder="Your UPI ID for rent (name@bank)" value={cfg.upi} onChange={(e) => setCfg({ ...cfg, upi: e.target.value })} />
        <button className="btn sec" onClick={run(async () => onUser(await api("/settings", "PATCH", cfg)))}>Save settings</button></div>

      <h2>Naya room + tenant</h2>
      <div className="card pad grid2">
        <input placeholder="Room no." value={f.number} onChange={(e) => setF({ ...f, number: e.target.value })} />
        <input placeholder="Rent ₹" type="number" value={f.rent} onChange={(e) => setF({ ...f, rent: e.target.value })} />
        <input placeholder="Tenant name" value={f.tenantName} onChange={(e) => setF({ ...f, tenantName: e.target.value })} />
        <input placeholder="Tenant phone" maxLength={10} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        <input className="span" placeholder="Temporary password (tenant must change it)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button className="btn span" onClick={run(async () => { await api("/rooms", "POST", f); setF(empty); })}>Room jodo</button>
      </div>

      {rem && <div className="sheet" onClick={() => setRem(null)}><div className="sh" onClick={(e) => e.stopPropagation()}>
        <b>Reminder {rem.source === "ai" ? "✨ AI-written" : "(template)"}</b>
        <p className="msg">{rem.text}</p>
        <a className="btn g" href={rem.link} target="_blank" rel="noreferrer">WhatsApp pe bhejo</a>
        <button className="btn sec" onClick={() => setRem(null)}>Band karo</button></div></div>}
    </>
  );
}
