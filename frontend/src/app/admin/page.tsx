"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PatientShell from "@/components/PatientShell";
import Link from "next/link";
import { Plus, Stethoscope, UserRound, ShieldCheck, Users, CalendarDays, Receipt, Activity, UserPlus, CalendarPlus, UserCog, FileText, ArrowRight } from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin", label: "Accueil" },
  { href: "/admin#utilisateurs", label: "Utilisateurs" },
  { href: "/admin#medecins", label: "Médecins" },
  { href: "/admin#secretaires", label: "Secrétaires" },
  { href: "/secretariat", label: "Patients et rendez-vous" },
];

type View = "overview" | "utilisateurs" | "medecins" | "secretaires";
const viewFromHash = (): View => {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash.replace("#", "");
  return (["utilisateurs", "medecins", "secretaires"].includes(h) ? h : "overview") as View;
};
const STATUS: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Programmé", tone: "blue" },
  confirmed: { label: "Confirmé", tone: "green" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "grey" },
  no_show: { label: "Absence", tone: "red" },
};
const pLocal = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(String(iso ?? ""));
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0)) : new Date(iso);
};
const mad = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(Number(v ?? 0));

type Staff = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialty?: string | null;
  is_active: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [clinic, setClinic] = useState<any>(null);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [secretaries, setSecretaries] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState<"doctor" | "secretary" | null>(null);
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", specialty: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [manage, setManage] = useState<Staff | null>(null);
  const [manageForm, setManageForm] = useState({ email: "", password: "" });
  const [manageError, setManageError] = useState("");
  const [manageMsg, setManageMsg] = useState("");
  const [view, setView] = useState<View>("overview");
  const [staffQuery, setStaffQuery] = useState("");
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    setView(viewFromHash());
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const load = useCallback(async () => {
    const [c, d, s, p, ap, inv] = await Promise.all([
      api<any>("/clinics/me").catch(() => null),
      api<Staff[]>("/staff/doctors").catch(() => []),
      api<Staff[]>("/secretaries").catch(() => []),
      api<any[]>("/patients/?status=all").catch(() => []),
      api<any[]>("/appointments/").catch(() => []),
      api<any[]>("/billing/invoices").catch(() => []),
    ]);
    setClinic(c);
    setDoctors(d ?? []);
    setSecretaries(s ?? []);
    setPatients(p ?? []);
    setAppointments(ap ?? []);
    setInvoices(inv ?? []);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("medical_token")) { router.push("/connexion"); return; }
      if (localStorage.getItem("medical_role") !== "clinic_admin") {
        setError("Cet espace est réservé à l'administrateur du cabinet.");
        setLoading(false);
        return;
      }
    }
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."))
      .finally(() => setLoading(false));
  }, [load, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.email.trim() || form.password.length < 8 || !form.first_name.trim() || !form.last_name.trim()) {
      setFormError("Tous les champs sont requis, mot de passe de huit caractères minimum.");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        clinic_id: clinic?.id ?? null,
      };
      if (open === "doctor") body.specialty = form.specialty.trim() || null;
      await api(open === "doctor" ? "/auth/register/doctor" : "/auth/register/secretary", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOpen(null);
      setForm({ email: "", password: "", first_name: "", last_name: "", specialty: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail() {
    if (!manage || !manageForm.email.trim()) return;
    setManageError(""); setManageMsg("");
    try {
      await api(`/staff/${manage.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ email: manageForm.email.trim() }),
      });
      setManageMsg("Email mis à jour.");
      await load();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  async function resetPassword() {
    if (!manage || manageForm.password.length < 8) {
      setManageError("Huit caractères minimum.");
      return;
    }
    setManageError(""); setManageMsg("");
    try {
      await api(`/staff/${manage.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ reset_password: manageForm.password }),
      });
      setManageMsg("Mot de passe réinitialisé. Communiquez-le de vive voix.");
      setManageForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  async function toggleActive() {
    if (!manage) return;
    setManageError(""); setManageMsg("");
    try {
      await api(`/staff/${manage.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !manage.is_active }),
      });
      setManage(null);
      await load();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  function openManage(s: Staff) {
    setManage(s);
    setManageForm({ email: s.email, password: "" });
    setManageError(""); setManageMsg("");
  }

  const activeCount = [...doctors, ...secretaries].filter((s) => s.is_active).length;
  const initialsOf = (s: Staff) => `${(s.first_name || "?")[0]}${(s.last_name || "")[0] ?? ""}`.toUpperCase();

  const staffTable = (all: Staff[], kind: "doctor" | "secretary") => {
    const sq = staffQuery.trim().toLowerCase();
    const list = sq ? all.filter((s) => `${s.first_name} ${s.last_name} ${s.email}`.toLowerCase().includes(sq)) : all;
    return list.length === 0 ? (
      <div className="empty">
        {kind === "doctor" ? "Aucun médecin rattaché au cabinet." : "Aucun compte de secrétariat."}
      </div>
    ) : (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{kind === "doctor" ? "Médecin" : "Secrétaire"}</th>
              <th>Email</th>
              {kind === "doctor" && <th>Spécialité</th>}
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className={s.is_active ? "" : "off"}>
                <td>
                  <div className="who">
                    <span className="avatar">{initialsOf(s)}</span>
                    <span className="name">{kind === "doctor" ? "Dr. " : ""}{s.first_name} {s.last_name}</span>
                  </div>
                </td>
                <td className="muted">{s.email}</td>
                {kind === "doctor" && <td>{s.specialty || <span className="muted">Médecine générale</span>}</td>}
                <td>
                  <span className={`pill ${s.is_active ? "pill-on" : ""}`}>{s.is_active ? "Actif" : "Désactivé"}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn ghost sm" onClick={() => openManage(s)}>Gérer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <PatientShell
      active={view === "overview" ? "/admin" : `/admin#${view}`}
      nav={ADMIN_NAV}
      home="/admin"
      roleLabel="Administrateur"
      eyebrow="ESPACE CABINET"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={clinic?.name ?? "Cabinet"}
      lastName=""
      title={view === "overview" ? undefined : view === "medecins" ? "Médecins" : view === "secretaires" ? "Secrétaires" : "Utilisateurs"}
      subtitle={view === "overview" ? undefined : `${clinic?.name ?? "Cabinet"} : ${doctors.length} médecin(s) et ${secretaries.length} secrétaire(s)`}
      onSearch={(q) => { window.location.hash = "utilisateurs"; setView("utilisateurs"); setStaffQuery(q); }}
      searchPlaceholder="Rechercher un utilisateur, un patient, un document…"
      notifCount={[...doctors, ...secretaries].filter((s) => !s.is_active).length}
    >
      <style jsx>{`
        .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
        .kpi { display: flex; align-items: center; gap: 16px; padding: 18px 20px; background: #fff; border: 1px solid #e1eaf3; border-radius: 14px; }
        .kpi-ic { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-ic.blue { background: #eaf3fd; color: #1877e0; }
        .kpi-ic.green { background: #e3f5ea; color: #1a7f4b; }
        .kpi-ic.amber { background: #fbf0de; color: #a86a12; }
        .kpi-k { display: block; font-size: 13px; color: #5a7590; }
        .kpi-v { display: block; font-size: 24px; font-weight: 800; margin-top: 2px; }
        .card { background: #fff; border: 1px solid #e1eaf3; border-radius: 14px; overflow: hidden; margin-bottom: 18px; }
        .head { padding: 16px 22px; border-bottom: 1px solid #e1eaf3; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        h2 { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; margin: 0; }
        .tbl-wrap { overflow-x: auto; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
        .tbl th { text-align: left; padding: 12px 22px; font-size: 13px; font-weight: 500; color: #5a7590; background: #f7fafd; border-bottom: 1px solid #e1eaf3; white-space: nowrap; }
        .tbl td { padding: 12px 22px; border-bottom: 1px solid #e1eaf3; vertical-align: middle; white-space: nowrap; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tr.off td { opacity: 0.55; }
        .who { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #eaf3fd; color: #1877e0; font-weight: 700; font-size: 13px; flex-shrink: 0; }
        .name { font-weight: 600; font-size: 15px; }
        .muted { color: #5a7590; }
        @media (max-width: 900px) { .kpis { grid-template-columns: 1fr; } }
        .empty { padding: 32px 24px; text-align: center; color: #5a7590; font-size: 14px; }
        .pill { padding: 4px 11px; border-radius: 7px; font-size: 12px; font-weight: 700; background: #eef2f6; color: #5a7590; }
        .btn { font: inherit; font-size: 14px; font-weight: 600; border-radius: 9px; cursor: pointer; padding: 11px 20px; border: 1px solid transparent; transition: transform 0.16s ease, background-color 0.18s ease; }
        .btn:hover { transform: translateY(-2px); }
        .primary { background: #1877e0; color: #fff; }
        .primary:hover { background: #0f5cbf; }
        .ghost { background: #fff; color: #0a2540; border-color: #e1eaf3; }
        .ghost:hover { border-color: #1877e0; color: #1877e0; }
        .danger { background: #fff; color: #cf3a3a; border-color: #e1eaf3; }
        .danger:hover { background: #fcebeb; border-color: #cf3a3a; }
        .sm { padding: 7px 14px; font-size: 13px; }
        .field { width: 100%; box-sizing: border-box; padding: 11px 14px; font: inherit; font-size: 14px; color: #0a2540; background: #fff; border: 1px solid #e1eaf3; border-radius: 9px; }
        .field:focus { outline: none; border-color: #1877e0; box-shadow: 0 0 0 4px rgba(24,119,224,0.14); }
        .lab { display: block; font-size: 13px; font-weight: 600; color: #5a7590; margin-bottom: 6px; }
        .overlay { position: fixed; inset: 0; z-index: 1000; padding: 24px; background: rgba(10,37,64,0.42); display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 18px; padding: 28px; width: 470px; max-width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 30px 70px rgba(10,37,64,0.28); }
        .modal-title { font-size: 20px; font-weight: 800; margin: 0 0 6px; }
        .modal-sub { font-size: 14px; color: #5a7590; margin: 0 0 22px; }
        .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
        .err { color: #cf3a3a; font-size: 14px; font-weight: 600; margin: 16px 0 0; }
        .ok { color: #1a7f4b; font-size: 14px; font-weight: 600; margin: 16px 0 0; }
        .alert { background: #fcebeb; color: #cf3a3a; padding: 13px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; }
        .block { padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid #e1eaf3; }

        .meta { font-size: 13px; color: #5a7590; margin-top: 2px; }
        .pill.pill-on { background: #e3f5ea; color: #1a7f4b; }
      `}</style>

      {view === "overview" && (() => {
        const now = new Date();
        const y = now.getFullYear(), mo = now.getMonth();
        const monthStart = new Date(y, mo, 1).getTime();
        const prevStart = new Date(y, mo - 1, 1).getTime();
        const daysInMonth = new Date(y, mo + 1, 0).getDate();
        const ts = (iso: string) => pLocal(iso).getTime();
        const todayAppts = appointments.filter((a2) => pLocal(a2.scheduled_at).toDateString() === now.toDateString() && a2.status !== "cancelled");
        const weekAppts = appointments.filter((a2) => { const d = ts(a2.scheduled_at); return d >= Date.now() - 3 * 86400000 && d <= Date.now() + 4 * 86400000; });
        const invMonth = invoices.filter((i) => ts(i.issued_at) >= monthStart);
        const invPrev = invoices.filter((i) => { const d = ts(i.issued_at); return d >= prevStart && d < monthStart; });
        const sumMonth = invMonth.reduce((s2, i) => s2 + Number(i.amount_due ?? 0), 0);
        const sumPrev = invPrev.reduce((s2, i) => s2 + Number(i.amount_due ?? 0), 0);
        const invTrend = sumPrev > 0 ? Math.round(((sumMonth - sumPrev) / sumPrev) * 100) : null;
        const seenMonth = new Set(appointments.filter((a2) => ts(a2.scheduled_at) >= monthStart && a2.status !== "cancelled").map((a2) => a2.patient_id)).size;
        const activeDoctors = doctors.filter((d) => d.is_active).length;

        const series = (list: any[], key: string, distinct?: string) => Array.from({ length: daysInMonth }, (_, i) => {
          const items = list.filter((x) => { const d = pLocal(x[key]); return d.getFullYear() === y && d.getMonth() === mo && d.getDate() === i + 1; });
          return distinct ? new Set(items.map((x) => x[distinct])).size : items.length;
        });
        const sPat = series(appointments.filter((a2) => a2.status !== "cancelled"), "scheduled_at", "patient_id");
        const sRdv = series(appointments, "scheduled_at");
        const sInv = series(invoices, "issued_at");
        const maxV = Math.max(1, ...sPat, ...sRdv, ...sInv);
        const W = 640, H = 200, P = 28;
        const pts = (s2: number[]) => s2.map((v, i) => `${P + (i * (W - 2 * P)) / Math.max(1, daysInMonth - 1)},${H - P - (v / maxV) * (H - 2 * P)}`).join(" ");
        const ticks = [0, 0.5, 1].map((f) => Math.round(maxV * f));
        const smooth = (s2: number[]) => {
          const xy = pts(s2).split(" ").map((c) => c.split(",").map(Number));
          return xy.map(([x, y], i) => {
            if (i === 0) return `M ${x} ${y}`;
            const [px, py] = xy[i - 1];
            const mx = (px + x) / 2;
            return `C ${mx} ${py} ${mx} ${y} ${x} ${y}`;
          }).join(" ");
        };

        const roles = [
          { label: "Patients", n: patients.length, color: "#1877e0" },
          { label: "Médecins", n: doctors.length, color: "#34c38f" },
          { label: "Secrétaires", n: secretaries.length, color: "#8b6cf0" },
          { label: "Admins", n: 1, color: "#f59e3d" },
        ];
        const totalUsers = roles.reduce((s2, r) => s2 + r.n, 0);
        let acc = 0;
        const donut = roles.filter((r) => r.n > 0).map((r) => { const f = (acc / totalUsers) * 360; acc += r.n; return `${r.color} ${f}deg ${(acc / totalUsers) * 360}deg`; }).join(", ");

        const pName = (id: string) => { const p = patients.find((x) => x.id === id); return p ? `${p.first_name} ${p.last_name}` : "Patient"; };
        const dName = (id: string) => { const d = doctors.find((x: any) => x.id === id); return d ? `Dr. ${d.first_name} ${d.last_name}` : "Médecin"; };
        const recent = [...appointments].sort((p1, p2) => ts(p2.scheduled_at) - ts(p1.scheduled_at)).slice(0, 5);

        return (
          <div className="pd dd">
            <div className="dd-hello-row">
              <div>
                <h1 className="pd-name pd-hello">Tableau de bord</h1>
                <p className="pd-sub" style={{ fontSize: 14 }}>Vue d&apos;ensemble de votre plateforme MedLink{clinic?.name ? `, ${clinic.name}` : ""}.</p>
              </div>
              <span className="ad-period"><CalendarDays size={15} /> {now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</span>
            </div>

            <div className="dd-stats" style={{ marginBottom: 18 }}>
              <div className="dd-stat"><span className="dd-stat-ic blue"><Users size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Total patients</span><b>{patients.length}</b><em>{seenMonth} vu{seenMonth > 1 ? "s" : ""} ce mois</em></span></div>
              <div className="dd-stat"><span className="dd-stat-ic green"><Stethoscope size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Médecins</span><b>{doctors.length}</b><em>{activeDoctors} actif{activeDoctors > 1 ? "s" : ""}</em></span></div>
              <div className="dd-stat"><span className="dd-stat-ic violet"><CalendarDays size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Rendez-vous aujourd&apos;hui</span><b>{todayAppts.length}</b><em>{weekAppts.length} cette semaine</em></span></div>
              <div className="dd-stat"><span className="dd-stat-ic orange"><Receipt size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Factures du mois</span><b>{mad(sumMonth)}</b><em className={invTrend !== null && invTrend < 0 ? "dd-warn" : ""}>{invTrend === null ? `${invMonth.length} facture(s)` : `${invTrend >= 0 ? "+" : ""}${invTrend} % vs mois dernier`}</em></span></div>
            </div>

            <div className="dd-grid">
              <section className="pd-card pd-sec">
                <div className="pd-sec-head">
                  <h2><Activity size={20} /> Activité de la plateforme</h2>
                  <div className="fx-legend">
                    <span><i style={{ background: "#1877e0" }} /> Patients</span>
                    <span><i style={{ background: "#34c38f" }} /> Rendez-vous</span>
                    <span><i style={{ background: "#f59e3d" }} /> Factures</span>
                  </div>
                </div>
                <svg viewBox={`0 0 ${W} ${H}`} className="ad-chart" role="img" aria-label="Activité quotidienne du mois">
                  {ticks.map((v) => { const yy = H - P - (v / maxV) * (H - 2 * P); return (<g key={v}><line x1={P} x2={W - P} y1={yy} y2={yy} stroke="#e1eaf3" /><text x={4} y={yy + 4} fontSize="10" fill="#8aa0b8">{v}</text></g>); })}
                  {[1, 5, 10, 15, 20, 25, daysInMonth].map((d) => (<text key={d} x={P + ((d - 1) * (W - 2 * P)) / Math.max(1, daysInMonth - 1)} y={H - 8} fontSize="10" fill="#8aa0b8" textAnchor="middle">{d}</text>))}
                  <path d={smooth(sInv)} fill="none" stroke="#f59e3d" strokeWidth="2" strokeLinecap="round" />
                  <path d={smooth(sRdv)} fill="none" stroke="#34c38f" strokeWidth="2" strokeLinecap="round" />
                  <path d={smooth(sPat)} fill="none" stroke="#1877e0" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><Users size={20} /> Répartition des utilisateurs</h2></div>
                <div className="pd-donut-wrap">
                  <div className="pd-donut dd-donut" style={{ background: `conic-gradient(${donut})` }}>
                    <div className="pd-donut-hole dd-donut-hole"><b>{totalUsers}</b><span>Total</span></div>
                  </div>
                  <ul className="pd-legend">
                    {roles.map((r) => (
                      <li key={r.label}><i style={{ background: r.color }} /><span style={{ flexGrow: 1 }}>{r.label}</span><b>{Math.round((r.n / totalUsers) * 100)}%</b></li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head">
                  <h2><CalendarDays size={20} /> Rendez-vous récents</h2>
                  <Link className="pd-link" href="/secretariat">Voir tous <ArrowRight size={14} /></Link>
                </div>
                {recent.length === 0 ? <div className="pd-empty">Aucun rendez-vous pour le moment.</div> : (
                  <div className="pd-scroll">
                    <table className="pd-table">
                      <thead><tr><th>Date &amp; Heure</th><th>Patient</th><th>Médecin</th><th>Statut</th></tr></thead>
                      <tbody>
                        {recent.map((r) => { const s2 = STATUS[r.status] ?? { label: r.status, tone: "grey" }; return (
                          <tr key={r.id}>
                            <td className="pd-nowrap">{pLocal(r.scheduled_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} {pLocal(r.scheduled_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</td>
                            <td className="pd-strong">{pName(r.patient_id)}</td>
                            <td>{dName(r.doctor_id)}</td>
                            <td><span className={`pd-pill ${s2.tone}`}>{s2.label}</span></td>
                          </tr>
                        ); })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><ArrowRight size={20} /> Actions rapides</h2></div>
                <div className="pd-quick">
                  <button onClick={() => { setOpen("doctor"); setFormError(""); }}><span className="pd-ic blue"><UserPlus size={20} /></span>Ajouter un médecin</button>
                  <button onClick={() => { setOpen("secretary"); setFormError(""); }}><span className="pd-ic violet"><UserPlus size={20} /></span>Ajouter une secrétaire</button>
                  <Link href="/admin#utilisateurs"><span className="pd-ic green"><UserCog size={20} /></span>Gérer les utilisateurs</Link>
                  <Link href="/secretariat"><span className="pd-ic orange"><FileText size={20} /></span>Patients, rendez-vous et factures</Link>
                </div>
              </section>
            </div>
          </div>
        );
      })()}

      {view !== "overview" && (<>
      <div className="kpis">
        <div className="kpi">
          <span className="kpi-ic blue"><Stethoscope size={22} /></span>
          <span><span className="kpi-k">Médecins</span><span className="kpi-v">{doctors.length}</span></span>
        </div>
        <div className="kpi">
          <span className="kpi-ic amber"><UserRound size={22} /></span>
          <span><span className="kpi-k">Secrétaires</span><span className="kpi-v">{secretaries.length}</span></span>
        </div>
        <div className="kpi">
          <span className="kpi-ic green"><ShieldCheck size={22} /></span>
          <span><span className="kpi-k">Comptes actifs</span><span className="kpi-v">{activeCount}</span></span>
        </div>
      </div>

      {view !== "secretaires" && (<div className="card">
        <div className="head">
          <h2><Stethoscope size={20} color="#1877e0" /> Médecins</h2>
          <button className="btn primary sm" onClick={() => { setOpen("doctor"); setFormError(""); }}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Ajouter un médecin
          </button>
        </div>
        {staffTable(doctors, "doctor")}
      </div>)}

      {view !== "medecins" && (<div className="card">
        <div className="head">
          <h2><UserRound size={20} color="#1877e0" /> Secrétariat</h2>
          <button className="btn primary sm" onClick={() => { setOpen("secretary"); setFormError(""); }}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Ajouter une secrétaire
          </button>
        </div>
        {staffTable(secretaries, "secretary")}
      </div>)}
      </>)}

      {open && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3 className="modal-title">{open === "doctor" ? "Nouveau médecin" : "Nouvelle secrétaire"}</h3>
            <p className="modal-sub">Le compte sera créé avec un mot de passe temporaire.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="lab">Prénom</label>
                <input className="field" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="lab">Nom</label>
                <input className="field" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="lab">Email professionnel</label>
              <input className="field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="lab">Mot de passe temporaire</label>
              <input className="field" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>

            {open === "doctor" && (
              <div>
                <label className="lab">Spécialité</label>
                <input className="field" placeholder="Médecine générale" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
              </div>
            )}

            {formError && <p className="err">{formError}</p>}

            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(null)}>Annuler</button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </form>
        </div>
      )}

      {manage && (
        <div className="overlay" onClick={() => setManage(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{manage.first_name} {manage.last_name}</h3>
            <p className="modal-sub">{manage.specialty ? `Médecin · ${manage.specialty}` : "Compte professionnel"}</p>

            <div className="block">
              <label className="lab">Adresse email</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="field" type="email" value={manageForm.email} onChange={(e) => setManageForm((f) => ({ ...f, email: e.target.value }))} />
                <button className="btn ghost sm" onClick={saveEmail} style={{ flexShrink: 0 }}>Enregistrer</button>
              </div>
            </div>

            <div className="block">
              <label className="lab">Réinitialiser le mot de passe</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="field" type="text" placeholder="Nouveau mot de passe" value={manageForm.password} onChange={(e) => setManageForm((f) => ({ ...f, password: e.target.value }))} />
                <button className="btn ghost sm" onClick={resetPassword} style={{ flexShrink: 0 }}>Réinitialiser</button>
              </div>
              <p className="meta" style={{ marginTop: 8 }}>
                Communiquez-le de vive voix. La personne pourra le changer depuis ses paramètres.
              </p>
            </div>

            <div>
              <label className="lab">Accès à la plateforme</label>
              <p className="meta" style={{ marginBottom: 12 }}>
                {manage.is_active
                  ? "Le compte est actif. Le désactiver empêche la connexion sans rien supprimer : consultations, ordonnances et factures restent intactes."
                  : "Le compte est désactivé. La personne ne peut plus se connecter."}
              </p>
              <button className={`btn ${manage.is_active ? "danger" : "primary"} sm`} onClick={toggleActive}>
                {manage.is_active ? "Désactiver le compte" : "Réactiver le compte"}
              </button>
            </div>

            {manageError && <p className="err">{manageError}</p>}
            {manageMsg && <p className="ok">{manageMsg}</p>}

            <div className="actions">
              <button className="btn ghost" onClick={() => setManage(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </PatientShell>
  );
}