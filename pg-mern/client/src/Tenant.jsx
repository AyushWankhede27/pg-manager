import { useEffect, useState } from "react";
import { api, inr } from "./api.js";

export default function Tenant() {
  const [d, setD] = useState(null), [err, setErr] = useState(""), [t, setT] = useState(""), [u, setU] = useState("");
  const load = () => api("/my").then(setD).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);
  const act = (fn) => async () => { setErr(""); try { await fn(); setT(""); await load(); } catch (e) { setErr(e.message); } };
  if (err && !d) return <p className="err">{err}</p>;
  if (!d) return <p className="mut pad">Loading…</p>;
  const { room, bills, complaints, insight: i } = d, cur = bills[bills.length - 1], max = Math.max(1, ...bills.map((b) => b.units));
  return (
    <>
      {err && <p className="err">{err}</p>}
      <h2>Room {room.number}</h2>
      {cur ? (
        <div className="card pad">
          <div className="line"><span>Rent</span><b>{inr(cur.rent)}</b></div>
          <div className="line"><span>Bijli ({cur.units} × ₹{cur.rate})</span><b>{inr(cur.units * cur.rate)}</b></div>
          <div className="line tot"><b>Total · {cur.month}</b><b>{inr(cur.total)}</b></div>
          {cur.status === "paid" ? <p className="ok">Paid ✓ Dhanyavaad!</p>
            : cur.status === "claimed" ? <p className="mut">Owner ke confirm karne ka wait…</p>
            : <>
              {d.upi && <a className="btn" href={`upi://pay?pa=${encodeURIComponent(d.upi)}&pn=${encodeURIComponent(d.pgName)}&am=${cur.total}&cu=INR&tn=${encodeURIComponent(`Room ${room.number} ${cur.month}`)}`}>Pay {inr(cur.total)} via UPI</a>}
              <input placeholder="UPI reference / UTR (optional)" value={u} onChange={(e) => setU(e.target.value)} />
              <button className="btn g" onClick={act(() => api("/my/claim", "POST", { utr: u }))}>Maine pay kar diya</button></>}
        </div>
      ) : <div className="card pad mut">Is mahine ka bill abhi nahi bana.</div>}

      {bills.length > 0 && <><h2>Aapki bijli (units)</h2><div className="card bars">
        {bills.slice(-6).map((b) => <div className="bar" key={b._id}><i className={b === cur ? "cur" : ""} style={{ height: (b.units / max) * 70 }} /><small>{b.units}</small></div>)}</div></>}

      {i && <><h2>AI Bill Coach</h2><div className="card ai">
        <p>{i.anomaly ? `⚡ Is mahine ${i.units} units, usual ${i.avg} se ${i.pct}% zyada. Extra ${inr(i.extra)}. AC 24°C par chalao, geyser/charger band karo.`
          : i.pct < -10 ? `🌱 Shabash! Usual (${i.avg}) se kam use kiya.` : `✅ Usage normal hai (usual ${i.avg} units).`}</p>
        <p>📈 Agle mahine ka estimate: <b>{inr(i.forecast)}</b></p></div></>}

      <h2>Complaint / request</h2>
      <div className="card pad"><input placeholder="e.g. Geyser kharab hai" value={t} onChange={(e) => setT(e.target.value)} />
        <button className="btn sec" onClick={act(() => api("/complaints", "POST", { text: t }))}>Owner ko bhejo</button></div>
      {complaints.length > 0 && <div className="card">{complaints.map((c) => <div className="row" key={c._id}><div className="who">{c.text}</div>
        <span className={"badge " + (c.status === "resolved" ? "p" : "b")}>{c.status === "resolved" ? "Solved" : "Open"}</span></div>)}</div>}
    </>
  );
}
