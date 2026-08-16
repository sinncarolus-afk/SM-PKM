import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import {
  Plus, X, ChevronRight, Calendar, ClipboardList, Gauge,
  AlertTriangle, CheckCircle2, Circle, Trash2, LogOut,
} from "lucide-react";

const SCHEMES = ["PKM-RE", "PKM-K", "PKM-M", "PKM-KC", "PKM-PM", "PKM-VGK", "PKM-AI", "PKM-GT"];
const STATUSES = ["Draft", "Revisi", "Siap Submit", "Submitted", "Lolos", "Tidak Lolos"];
const ASPECTS = [
  { key: "tema", label: "Kesesuaian Tema", weight: 20 },
  { key: "urgensi", label: "Urgensi Masalah", weight: 25 },
  { key: "metode", label: "Ketepatan Metode", weight: 30 },
  { key: "kelayakan", label: "Kelayakan Pelaksanaan", weight: 25 },
];
const MILESTONES = ["Judul & Latar Belakang", "Tinjauan Pustaka", "Metode Pelaksanaan", "Anggaran Biaya", "Draft Final"];
const STATUS_COLOR = {
  "Draft": "#6B7280", "Revisi": "#E8A33D", "Siap Submit": "#5BA3D9",
  "Submitted": "#8B6FE8", "Lolos": "#4FB477", "Tidak Lolos": "#E85C5C",
};
const uid = () => Math.random().toString(36).slice(2, 10);

function skorTotal(skor) {
  const filled = ASPECTS.filter((a) => skor[a.key] != null);
  if (filled.length === 0) return null;
  const sum = ASPECTS.reduce((s, a) => s + (skor[a.key] || 0) * a.weight, 0);
  const weightSum = ASPECTS.reduce((s, a) => s + a.weight, 0);
  return Math.round((sum / weightSum) * 10) / 10;
}
function progresPct(milestones) {
  const vals = Object.values(milestones || {});
  if (!vals.length) return 0;
  return Math.round((vals.filter(Boolean).length / vals.length) * 100);
}

// ---------- AUTH GATE ----------
// Manajemen login: password statis dari env var (ganti sesuka Anda).
// Ketua tim login: memasukkan access_code milik timnya (kolom `access_code` di tabel tims).
function LoginGate({ onLogin }) {
  const [mode, setMode] = useState("ketua"); // 'ketua' | 'manajemen'
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    if (mode === "manajemen") {
      const pass = import.meta.env.VITE_MANAJEMEN_PASSWORD;
      if (input === pass) onLogin({ role: "manajemen" });
      else setError("Password salah.");
    } else {
      const { data, error: err } = await supabase.from("tims").select("*").eq("access_code", input.trim()).single();
      if (err || !data) setError("Kode akses tidak ditemukan.");
      else onLogin({ role: "ketua", timId: data.id });
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#1B1F2A", color: "#E7E9EE", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <div style={{ width: 340, background: "#242938", border: "1px solid #2E3548", borderRadius: 12, padding: 28 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>PKM Command</div>
        <div style={{ fontSize: 12, color: "#7C8496", marginBottom: 20 }}>Masuk sebagai:</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
          <button onClick={() => { setMode("ketua"); setInput(""); setError(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "1px solid #3A4256", background: mode === "ketua" ? "#2A3040" : "transparent", color: "#E7E9EE", fontSize: 13 }}>Ketua Tim</button>
          <button onClick={() => { setMode("manajemen"); setInput(""); setError(""); }} style={{ flex: 1, padding: "8px 0", borderRadius: 6, border: "1px solid #3A4256", background: mode === "manajemen" ? "#2A3040" : "transparent", color: "#E7E9EE", fontSize: 13 }}>Manajemen</button>
        </div>
        <input
          type={mode === "manajemen" ? "password" : "text"}
          placeholder={mode === "manajemen" ? "Password manajemen" : "Kode akses tim"}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={{ width: "100%", background: "#1B1F2A", border: "1px solid #3A4256", borderRadius: 6, padding: "10px 12px", color: "#E7E9EE", fontSize: 14, marginBottom: 12, outline: "none" }}
        />
        {error && <div style={{ color: "#E85C5C", fontSize: 12, marginBottom: 12 }}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{ width: "100%", background: "#E8A33D", border: "none", borderRadius: 6, padding: "10px 0", color: "#1B1F2A", fontWeight: 600, fontSize: 14 }}>
          {loading ? "Memeriksa…" : "Masuk"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(null);
  const [tims, setTims] = useState(null);
  const [view, setView] = useState("dashboard");
  const [activeId, setActiveId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  const fetchTims = useCallback(async () => {
    const { data } = await supabase.from("tims").select("*").order("created_at", { ascending: true });
    setTims(data || []);
  }, []);

  useEffect(() => {
    if (!auth) return;
    fetchTims();
    // live update: refresh saat ada perubahan dari user lain (mis. ketua tim update progres)
    const channel = supabase
      .channel("tims-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "tims" }, () => fetchTims())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [auth, fetchTims]);

  if (!auth) return <LoginGate onLogin={setAuth} />;
  if (tims === null) return <Loading />;

  const isKetua = auth.role === "ketua";

  const addTim = async () => {
    if (!newName.trim()) return;
    const access_code = uid().toUpperCase();
    await supabase.from("tims").insert({
      nama: newName.trim(),
      skema: SCHEMES[0],
      milestones: MILESTONES.reduce((a, m) => ({ ...a, [m]: false }), {}),
      skor: {},
      access_code,
    });
    setNewName("");
    setShowAdd(false);
    fetchTims();
  };

  const updateTim = async (id, patch) => {
    await supabase.from("tims").update(patch).eq("id", id);
    fetchTims();
  };
  const deleteTim = async (id) => {
    await supabase.from("tims").delete().eq("id", id);
    if (activeId === id) { setActiveId(null); setView("dashboard"); }
    fetchTims();
  };

  // Ketua tim: langsung dikunci ke detail timnya sendiri, tanpa sidebar navigasi tim lain
  if (isKetua) {
    const myTim = tims.find((t) => t.id === auth.timId);
    if (!myTim) return <Loading text="Tim tidak ditemukan." />;
    return (
      <div style={{ minHeight: "100vh", background: "#1B1F2A", color: "#E7E9EE", fontFamily: "'IBM Plex Sans', sans-serif" }}>
        <GlobalStyle />
        <div style={{ padding: "24px 40px", borderBottom: "1px solid #2A3040", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="display" style={{ fontWeight: 700, fontSize: 16 }}>PKM Command — Ruang Tim</div>
          <button onClick={() => setAuth(null)} style={{ background: "none", border: "none", color: "#7C8496", display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}><LogOut size={14} /> Keluar</button>
        </div>
        <div style={{ padding: "32px 40px", maxWidth: 900 }}>
          <TimDetail tim={myTim} onUpdate={(p) => updateTim(myTim.id, p)} onBack={null} restricted />
        </div>
      </div>
    );
  }

  // Manajemen: akses penuh
  const active = tims.find((t) => t.id === activeId);
  return (
    <div style={{ minHeight: "100vh", background: "#1B1F2A", color: "#E7E9EE", fontFamily: "'IBM Plex Sans', sans-serif", display: "flex" }}>
      <GlobalStyle />
      <div style={{ width: 220, borderRight: "1px solid #2A3040", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        <div className="display" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>PKM Command</div>
        <div className="mono" style={{ fontSize: 11, color: "#7C8496", marginBottom: 24 }}>MISI: SEMUA TIM LOLOS</div>
        <NavBtn label="Dashboard" icon={Gauge} active={view === "dashboard"} onClick={() => { setView("dashboard"); setActiveId(null); }} />
        <NavBtn label="Tim PKM" icon={ClipboardList} active={view === "tims" || view === "detail"} onClick={() => { setView("tims"); setActiveId(null); }} />
        <NavBtn label="Kalender" icon={Calendar} active={view === "kalender"} onClick={() => { setView("kalender"); setActiveId(null); }} />
        <button onClick={() => setAuth(null)} style={{ marginTop: "auto", background: "none", border: "none", color: "#7C8496", display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "9px 12px" }}><LogOut size={15} /> Keluar</button>
      </div>
      <div style={{ flex: 1, padding: "32px 40px", overflowY: "auto" }}>
        {view === "dashboard" && <Dashboard tims={tims} onOpen={(id) => { setActiveId(id); setView("detail"); }} />}
        {view === "tims" && <TimList tims={tims} onOpen={(id) => { setActiveId(id); setView("detail"); }} onAdd={() => setShowAdd(true)} onDelete={deleteTim} />}
        {view === "detail" && active && <TimDetail tim={active} onUpdate={(p) => updateTim(active.id, p)} onBack={() => { setView("tims"); setActiveId(null); }} />}
        {view === "kalender" && <Kalender tims={tims} />}
      </div>
      {showAdd && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,12,18,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={() => setShowAdd(false)}>
          <div style={{ background: "#242938", border: "1px solid #333B4F", borderRadius: 10, padding: 24, width: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="display" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Tim PKM Baru</div>
            <input autoFocus placeholder="Nama tim" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTim()}
              style={{ width: "100%", background: "#1B1F2A", border: "1px solid #3A4256", borderRadius: 6, padding: "10px 12px", color: "#E7E9EE", fontSize: 14, marginBottom: 16, outline: "none" }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowAdd(false)} style={{ background: "transparent", border: "1px solid #3A4256", borderRadius: 6, padding: "8px 14px", color: "#B4BACA", fontSize: 13 }}>Batal</button>
              <button onClick={addTim} style={{ background: "#E8A33D", border: "none", borderRadius: 6, padding: "8px 14px", color: "#1B1F2A", fontWeight: 600, fontSize: 13 }}>Tambah</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      * { box-sizing: border-box; }
      button { font-family: inherit; cursor: pointer; }
      input, textarea, select { font-family: inherit; }
      .mono { font-family: 'IBM Plex Mono', monospace; }
      .display { font-family: 'Space Grotesk', sans-serif; }
    `}</style>
  );
}
function Loading({ text = "Memuat…" }) {
  return <div style={{ minHeight: "100vh", background: "#1B1F2A", display: "flex", alignItems: "center", justifyContent: "center", color: "#E7E9EE" }}>{text}</div>;
}
function NavBtn({ label, icon: Icon, active, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 7, background: active ? "#2A3040" : "transparent", border: "none", color: active ? "#E7E9EE" : "#8B93A6", fontSize: 14, textAlign: "left", fontWeight: active ? 600 : 400 }}>
      <Icon size={16} />{label}
    </button>
  );
}
function StatusDot({ status }) {
  return <span style={{ width: 9, height: 9, borderRadius: "50%", background: STATUS_COLOR[status], display: "inline-block", flexShrink: 0 }} />;
}
function EmptyRow({ text }) {
  return <div style={{ background: "#242938", border: "1px dashed #333B4F", borderRadius: 8, padding: 20, color: "#7C8496", fontSize: 13, textAlign: "center" }}>{text}</div>;
}
function StatCard({ label, value, color = "#E7E9EE" }) {
  return (
    <div style={{ background: "#242938", border: "1px solid #2E3548", borderRadius: 10, padding: "16px 18px" }}>
      <div className="mono" style={{ fontSize: 11, color: "#7C8496", marginBottom: 6, textTransform: "uppercase" }}>{label}</div>
      <div className="display" style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function Dashboard({ tims, onOpen }) {
  const total = tims.length;
  const lolos = tims.filter((t) => t.status === "Lolos").length;
  const avgSkor = (() => {
    const vals = tims.map((t) => skorTotal(t.skor)).filter((v) => v != null);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "-";
  })();
  const berisiko = tims
    .map((t) => ({ t, pct: progresPct(t.milestones), skor: skorTotal(t.skor) }))
    .filter((x) => x.t.status !== "Lolos" && x.t.status !== "Tidak Lolos")
    .sort((a, b) => (a.skor || 0) - (b.skor || 0) || a.pct - b.pct)
    .slice(0, 5);
  return (
    <div>
      <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>Ruang Kendali</div>
      <div className="mono" style={{ fontSize: 12, color: "#7C8496", marginBottom: 28 }}>TARGET: {total} / {total} TIM LOLOS PENDANAAN</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 32 }}>
        <StatCard label="Total Tim" value={total} />
        <StatCard label="Lolos" value={lolos} color="#4FB477" />
        <StatCard label="Rata-rata Skor" value={avgSkor} color="#E8A33D" />
        <StatCard label="Sesi Bimbingan" value={tims.reduce((s, t) => s + (t.jadwal?.length || 0), 0)} />
      </div>
      <div className="display" style={{ fontSize: 15, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={15} color="#E8A33D" /> Prioritas Pendampingan</div>
      <div style={{ fontSize: 12, color: "#7C8496", margin: "4px 0 14px" }}>Tim dengan skor terendah & progres paling lambat</div>
      {berisiko.length === 0 && <EmptyRow text="Belum ada tim untuk dipantau." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {berisiko.map(({ t, pct, skor }) => (
          <div key={t.id} onClick={() => onOpen(t.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#242938", border: "1px solid #2E3548", borderRadius: 8, padding: "12px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <StatusDot status={t.status} />
              <div><div style={{ fontSize: 14, fontWeight: 600 }}>{t.nama}</div><div className="mono" style={{ fontSize: 11, color: "#7C8496" }}>{t.skema}</div></div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 12, color: "#B4BACA" }}>Progres {pct}%</div>
                <div className="mono" style={{ fontSize: 12, color: "#B4BACA" }}>Skor {skor ?? "-"}</div>
              </div>
              <ChevronRight size={16} color="#5B6478" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimList({ tims, onOpen, onAdd, onDelete }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div><div className="display" style={{ fontSize: 24, fontWeight: 700 }}>Tim PKM</div><div className="mono" style={{ fontSize: 12, color: "#7C8496" }}>{tims.length} TIM TERDAFTAR</div></div>
        <button onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 6, background: "#E8A33D", border: "none", borderRadius: 7, padding: "9px 16px", color: "#1B1F2A", fontWeight: 600, fontSize: 13 }}><Plus size={15} /> Tim Baru</button>
      </div>
      {tims.length === 0 && <EmptyRow text="Belum ada tim. Klik 'Tim Baru' untuk mulai." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tims.map((t) => {
          const pct = progresPct(t.milestones);
          const skor = skorTotal(t.skor);
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#242938", border: "1px solid #2E3548", borderRadius: 8, padding: "14px 16px" }}>
              <div onClick={() => onOpen(t.id)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
                <StatusDot status={t.status} />
                <div><div style={{ fontSize: 14, fontWeight: 600 }}>{t.nama}</div><div className="mono" style={{ fontSize: 11, color: "#7C8496" }}>{t.skema} · {t.status} · kode: {t.access_code}</div></div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <div style={{ width: 90 }}>
                  <div style={{ height: 5, background: "#1B1F2A", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct}%`, background: "#5BA3D9" }} /></div>
                  <div className="mono" style={{ fontSize: 10, color: "#7C8496", marginTop: 3 }}>{pct}% milestone</div>
                </div>
                <div className="mono" style={{ fontSize: 13, color: "#E8A33D", width: 40, textAlign: "right" }}>{skor ?? "-"}</div>
                <button onClick={() => onDelete(t.id)} style={{ background: "transparent", border: "none", color: "#5B6478" }}><Trash2 size={15} /></button>
                <ChevronRight size={16} color="#5B6478" onClick={() => onOpen(t.id)} style={{ cursor: "pointer" }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TimDetail({ tim, onUpdate, onBack, restricted = false }) {
  const [jadwalDate, setJadwalDate] = useState("");
  const [jadwalAgenda, setJadwalAgenda] = useState("");
  const pct = progresPct(tim.milestones);
  const skor = skorTotal(tim.skor);
  const jadwal = tim.jadwal || [];

  const toggleMilestone = (m) => onUpdate({ milestones: { ...tim.milestones, [m]: !tim.milestones[m] } });
  const setSkor = (key, val) => onUpdate({ skor: { ...tim.skor, [key]: val === "" ? null : Number(val) } });
  const addJadwal = () => {
    if (!jadwalDate) return;
    const entry = { id: uid(), tanggal: jadwalDate, agenda: jadwalAgenda || "Sesi bimbingan" };
    onUpdate({ jadwal: [...jadwal, entry].sort((a, b) => a.tanggal.localeCompare(b.tanggal)) });
    setJadwalDate(""); setJadwalAgenda("");
  };
  const removeJadwal = (id) => onUpdate({ jadwal: jadwal.filter((j) => j.id !== id) });

  return (
    <div>
      {onBack && <button onClick={onBack} style={{ background: "none", border: "none", color: "#7C8496", fontSize: 13, marginBottom: 16 }}>← Kembali ke daftar tim</button>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div><div className="display" style={{ fontSize: 24, fontWeight: 700 }}>{tim.nama}</div><div className="mono" style={{ fontSize: 12, color: "#7C8496" }}>{tim.skema}</div></div>
        {restricted ? (
          <span style={{ background: "#242938", border: "1px solid #3A4256", borderRadius: 6, padding: "8px 12px", color: STATUS_COLOR[tim.status], fontWeight: 600, fontSize: 13 }}>{tim.status}</span>
        ) : (
          <select value={tim.status} onChange={(e) => onUpdate({ status: e.target.value })} style={{ background: "#242938", border: "1px solid #3A4256", borderRadius: 6, padding: "8px 12px", color: STATUS_COLOR[tim.status], fontWeight: 600, fontSize: 13 }}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Panel title={`Milestone Progres — ${pct}%`}>
          {MILESTONES.map((m) => (
            <div key={m} onClick={() => toggleMilestone(m)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", cursor: "pointer" }}>
              {tim.milestones?.[m] ? <CheckCircle2 size={17} color="#4FB477" /> : <Circle size={17} color="#5B6478" />}
              <span style={{ fontSize: 13, color: tim.milestones?.[m] ? "#E7E9EE" : "#8B93A6", textDecoration: tim.milestones?.[m] ? "line-through" : "none" }}>{m}</span>
            </div>
          ))}
        </Panel>
        <Panel title={`Penilaian Proposal — Skor: ${skor ?? "-"}`}>
          {ASPECTS.map((a) => (
            <div key={a.key} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#B4BACA", marginBottom: 4 }}>
                <span>{a.label} <span className="mono" style={{ color: "#5B6478" }}>({a.weight}%)</span></span>
                <span className="mono">{tim.skor?.[a.key] ?? "-"}/100</span>
              </div>
              <input type="range" min={0} max={100} value={tim.skor?.[a.key] ?? 0} disabled={restricted} onChange={(e) => setSkor(a.key, e.target.value)} style={{ width: "100%", accentColor: "#E8A33D", opacity: restricted ? 0.6 : 1 }} />
            </div>
          ))}
          {restricted && <div style={{ fontSize: 11, color: "#5B6478", marginTop: 4 }}>Skor hanya bisa diubah oleh manajemen.</div>}
        </Panel>
      </div>
      <div style={{ marginTop: 20 }}>
        <Panel title="Catatan Fasilitator">
          <textarea value={tim.catatan || ""} onChange={(e) => onUpdate({ catatan: e.target.value })} placeholder="Feedback kualitatif untuk tim ini…" rows={3} disabled={restricted}
            style={{ width: "100%", background: "#1B1F2A", border: "1px solid #3A4256", borderRadius: 6, padding: 10, color: "#E7E9EE", fontSize: 13, resize: "vertical", outline: "none" }} />
        </Panel>
      </div>
      <div style={{ marginTop: 20 }}>
        <Panel title="Jadwal Bimbingan">
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <input type="date" value={jadwalDate} onChange={(e) => setJadwalDate(e.target.value)} style={{ background: "#1B1F2A", border: "1px solid #3A4256", borderRadius: 6, padding: "7px 10px", color: "#E7E9EE", fontSize: 12 }} />
            <input placeholder="Agenda" value={jadwalAgenda} onChange={(e) => setJadwalAgenda(e.target.value)} style={{ flex: 1, background: "#1B1F2A", border: "1px solid #3A4256", borderRadius: 6, padding: "7px 10px", color: "#E7E9EE", fontSize: 12 }} />
            <button onClick={addJadwal} style={{ background: "#5BA3D9", border: "none", borderRadius: 6, padding: "7px 14px", color: "#12172B", fontWeight: 600, fontSize: 12 }}>Tambah</button>
          </div>
          {jadwal.length === 0 && <div style={{ fontSize: 12, color: "#5B6478" }}>Belum ada sesi terjadwal.</div>}
          {jadwal.map((j) => (
            <div key={j.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #2A3040" }}>
              <div><span className="mono" style={{ fontSize: 12, color: "#E8A33D" }}>{j.tanggal}</span><span style={{ fontSize: 13, marginLeft: 10 }}>{j.agenda}</span></div>
              <button onClick={() => removeJadwal(j.id)} style={{ background: "none", border: "none", color: "#5B6478" }}><X size={14} /></button>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div style={{ background: "#242938", border: "1px solid #2E3548", borderRadius: 10, padding: 18 }}>
      <div className="display" style={{ fontSize: 13, fontWeight: 600, color: "#B4BACA", marginBottom: 12, textTransform: "uppercase" }}>{title}</div>
      {children}
    </div>
  );
}

function Kalender({ tims }) {
  const all = tims.flatMap((t) => (t.jadwal || []).map((j) => ({ ...j, timNama: t.nama }))).sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  return (
    <div>
      <div className="display" style={{ fontSize: 24, fontWeight: 700 }}>Kalender Bimbingan</div>
      <div className="mono" style={{ fontSize: 12, color: "#7C8496", marginBottom: 24 }}>SEMUA SESI, LINTAS TIM</div>
      {all.length === 0 && <EmptyRow text="Belum ada sesi bimbingan terjadwal." />}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {all.map((j) => (
          <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 16, background: "#242938", border: "1px solid #2E3548", borderRadius: 8, padding: "12px 16px" }}>
            <div className="mono" style={{ fontSize: 13, color: "#E8A33D", width: 100 }}>{j.tanggal}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{j.agenda}</div><div className="mono" style={{ fontSize: 11, color: "#7C8496" }}>{j.timNama}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}
