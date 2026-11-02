const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem("tok"), admin = false, es = null, jobId = null;
const show = (el, on) => $(el).classList.toggle("hidden", !on);
const msg = t => { $("#msg").textContent = t || ""; };
async function api(path, method = "GET", body) {
  const r = await fetch(window.API_URL + "/api" + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && token) { logout(); }
  if (!r.ok) throw new Error(j.error || "Request failed");
  return j;
}
function logout() { token = null; localStorage.removeItem("tok"); show("#app", false); show("#login", true); }
async function enter() {
  try { const me = await api("/me"); admin = me.admin; $("#who").textContent = "👤 " + me.user + (me.exp ? " · until " + new Date(me.exp).toLocaleString() : " (owner)");
    show("#login", false); show("#app", true); show("#adminTab", admin); loadHistory(); }
  catch { show("#login", true); }
}
$("#loginBtn").onclick = async () => {
  $("#lerr").textContent = "";
  try { const j = await api("/login", "POST", { username: $("#lu").value.trim(), password: $("#lp").value }); token = j.token; localStorage.setItem("tok", token); $("#lp").value = ""; enter(); }
  catch (e) { $("#lerr").textContent = e.message; }
};
$("#logout").onclick = logout;
$$("nav button").forEach(b => b.onclick = () => { $$("nav button").forEach(x => x.classList.toggle("on", x === b)); $$(".tab").forEach(t => t.classList.add("hidden")); show("#" + b.dataset.tab, true); if (b.dataset.tab === "history") loadHistory(); if (b.dataset.tab === "admin") loadUsers(); });
const form = f => Object.fromEntries(new FormData(f));
$("#f").onsubmit = e => { e.preventDefault(); start("/install", form(e.target), "Install"); };
$("#rf").onsubmit = e => { e.preventDefault(); start("/fix-docker", form(e.target), "Docker repair"); };

async function start(path, data, title) {
  msg(""); try { const j = await api(path, "POST", data); watch(j.jobId, title); } catch (e) { msg(e.message); }
}
function watch(id, title) {
  jobId = id; if (es) es.close();
  show("#logbox", true); $("#ltitle").textContent = title; $("#log").textContent = ""; $("#pbar").style.width = "3%";
  es = new EventSource(`${window.API_URL}/api/jobs/${id}/stream?t=${encodeURIComponent(token)}`);
  es.onmessage = ev => { const l = JSON.parse(ev.data), log = $("#log"); log.textContent += l + "\n"; log.scrollTop = log.scrollHeight;
    const m = /^### \[(\d+)\/(\d+)\]/.exec(l); if (m) $("#pbar").style.width = (m[1] / m[2] * 100) + "%"; };
  es.addEventListener("end", ev => { es.close(); $("#pbar").style.width = ev.data === "done" ? "100%" : "100%"; $("#ltitle").textContent = title + (ev.data === "done" ? " ✅ finished" : " ❌ " + ev.data); loadHistory(); });
  es.onerror = () => { /* the browser retries; the server replays the log */ };
}
$("#cancel").onclick = () => jobId && api(`/jobs/${jobId}/cancel`, "POST").catch(() => {});

async function loadHistory() {
  try { const j = await api("/jobs"); $("#hlist").innerHTML = j.length ? "" : "<p class='hint'>Nothing yet.</p>";
    j.forEach(x => { const d = document.createElement("div"); d.className = "item";
      d.innerHTML = `<span>${esc(x.title)}<br>${esc(x.panel || x.ip || "")}${admin ? " · " + esc(x.owner) : ""}<br>${new Date(x.start).toLocaleString()}</span><span class="${x.status === "done" ? "ok" : x.status === "failed" ? "bad" : ""}">${x.status}</span>`;
      d.onclick = () => watch(x.id, x.title); $("#hlist").appendChild(d); }); } catch {}
}
async function loadUsers() {
  const j = await api("/admin/users"); $("#ulist").innerHTML = j.length ? "" : "<p class='hint'>No users yet.</p>";
  j.forEach(u => { const d = document.createElement("div"); d.className = "item"; const left = u.exp - Date.now();
    d.innerHTML = `<span>${esc(u.name)}<br>${left > 0 ? "until " + new Date(u.exp).toLocaleString() : "expired"}</span>`;
    const b = document.createElement("button"); b.textContent = "Remove"; b.onclick = async () => { await api("/admin/users/" + encodeURIComponent(u.name), "DELETE"); loadUsers(); };
    d.appendChild(b); $("#ulist").appendChild(d); });
}
$("#af").onsubmit = async e => { e.preventDefault(); try { await api("/admin/users", "POST", form(e.target)); e.target.reset(); msg(""); loadUsers(); } catch (er) { msg(er.message); } };
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
token ? enter() : show("#login", true);
