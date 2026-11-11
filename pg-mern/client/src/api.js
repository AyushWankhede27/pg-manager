const BASE = import.meta.env.VITE_API || "/api";
export async function api(path, method = "GET", body) {
  const t = localStorage.getItem("t");
  const res = await fetch(BASE + path, {
    method, body: body ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json", ...(t ? { Authorization: "Bearer " + t } : {}) },
  });
  if (res.status === 401 && t) { localStorage.clear(); location.reload(); }
  const d = res.status === 204 ? {} : await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || "Request failed");
  return d;
}
export const inr = (n) => "₹" + Math.round(n || 0).toLocaleString("en-IN");
