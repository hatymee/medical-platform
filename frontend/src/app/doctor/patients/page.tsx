"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Users, CalendarDays, CalendarCheck, TriangleAlert, Search, ChevronRight, FolderOpen } from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal, clock } from "@/components/PatientShell";

type Filter = "all" | "upcoming" | "inactive";

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fDate = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

function ageOf(dob?: string | null) {
  if (!dob) return null;
  const d = parseLocal(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

export default function DoctorPatientsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const [profile, list, apts] = await Promise.all([
          api<any>("/doctors/me").catch(() => null),
          api<any[]>("/patients/").catch(() => []),
          api<any[]>("/appointments/mine").catch(() => []),
        ]);
        setMe(profile);
        setPatients(list ?? []);
        setAppointments(apts ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger vos patients.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const live = appointments.filter((a) => a.scheduled_at && a.status !== "cancelled");
  const lastVisit = (pid: string) => live.filter((a) => a.patient_id === pid && t(a.scheduled_at) <= now).sort((a, b) => t(b.scheduled_at) - t(a.scheduled_at))[0];
  const nextVisit = (pid: string) => live.filter((a) => a.patient_id === pid && t(a.scheduled_at) > now).sort((a, b) => t(a.scheduled_at) - t(b.scheduled_at))[0];

  const rows = patients.map((p) => ({ p, last: lastVisit(p.id), next: nextVisit(p.id) }));
  const withUpcoming = rows.filter((r) => r.next);
  const inactive = rows.filter((r) => !r.next && (!r.last || t(r.last.scheduled_at) < now - 30 * 86400000));
  const seenThisMonth = rows.filter((r) => r.last && t(r.last.scheduled_at) >= monthStart);

  const base = filter === "upcoming" ? withUpcoming : filter === "inactive" ? inactive : rows;
  const q = query.trim().toLowerCase();
  const shown = base
    .filter(({ p }) => !q || `${p.first_name} ${p.last_name} ${p.last_name} ${p.first_name} ${p.national_id ?? ""}`.toLowerCase().includes(q))
    .sort((a, b) => (b.last ? t(b.last.scheduled_at) : 0) - (a.last ? t(a.last.scheduled_at) : 0));

  const initials = (p: any) => `${(p.first_name ?? "?")[0]}${(p.last_name ?? "")[0] ?? ""}`.toUpperCase();
  const sexLabel = (s?: string | null) => (s === "M" || s === "male" ? "Homme" : s === "F" || s === "female" ? "Femme" : "—");

  return (
    <PatientShell
      active="/doctor/patients"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin généraliste"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me?.first_name}
      lastName={me?.last_name}
      onSearch={(s) => { setQuery(s); setFilter("all"); }}
      searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
      notifCount={live.filter((a) => a.status === "scheduled" && t(a.scheduled_at) > now).length}
    >
      <div className="pd dd">
        <div className="dd-hello-row">
          <div>
            <h1 className="pd-name pd-hello">Mes patients</h1>
            <p className="pd-sub" style={{ fontSize: 14 }}>{patients.length} dossier{patients.length > 1 ? "s" : ""} au cabinet. Cliquez sur un patient pour ouvrir son dossier.</p>
          </div>
        </div>

        <div className="dd-stats" style={{ marginBottom: 18 }}>
          <button className={`dd-stat ${filter === "all" ? "dd-sel" : ""}`} onClick={() => setFilter("all")}>
            <span className="dd-stat-ic green"><Users size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Total patients</span><b>{patients.length}</b><em>dossiers du cabinet</em></span>
          </button>
          <button className={`dd-stat ${filter === "upcoming" ? "dd-sel" : ""}`} onClick={() => setFilter("upcoming")}>
            <span className="dd-stat-ic blue"><CalendarDays size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Avec rendez-vous à venir</span><b>{withUpcoming.length}</b><em>à suivre prochainement</em></span>
          </button>
          <div className="dd-stat">
            <span className="dd-stat-ic violet"><CalendarCheck size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Vus ce mois-ci</span><b>{seenThisMonth.length}</b><em>au moins une visite</em></span>
          </div>
          <button className={`dd-stat ${filter === "inactive" ? "dd-sel" : ""}`} onClick={() => setFilter("inactive")}>
            <span className="dd-stat-ic orange"><TriangleAlert size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Sans visite depuis 30 jours</span><b>{inactive.length}</b><em className="dd-warn">à recontacter</em></span>
          </button>
        </div>

        <section className="pd-card pd-sec">
          <div className="pd-sec-head"><h2><Users size={20} /> Liste des patients</h2></div>
          <div className="pd-toolbar">
            <div className="pd-chips">
              <button className={`pd-chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>Tous <em>{rows.length}</em></button>
              <button className={`pd-chip ${filter === "upcoming" ? "on" : ""}`} onClick={() => setFilter("upcoming")}>Rendez-vous à venir <em>{withUpcoming.length}</em></button>
              <button className={`pd-chip ${filter === "inactive" ? "on" : ""}`} onClick={() => setFilter("inactive")}>Sans visite 30 j <em>{inactive.length}</em></button>
            </div>
            <div className="pd-search">
              <Search size={16} />
              <input placeholder="Nom ou CIN" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="pd-empty">{patients.length === 0 ? "Aucun patient enregistré. La secrétaire crée les dossiers depuis son espace." : "Aucun patient ne correspond."}</div>
          ) : (
            <div className="pd-scroll">
              <table className="pd-table">
                <thead><tr><th>Patient</th><th>CIN</th><th>Âge</th><th>Sexe</th><th>Groupe</th><th>Dernière visite</th><th>Prochain RDV</th><th></th></tr></thead>
                <tbody>
                  {shown.map(({ p, last, next }) => {
                    const age = ageOf(p.date_of_birth);
                    return (
                      <tr key={p.id} className="pd-click" onClick={() => router.push(`/doctor/patients/${p.id}`)}>
                        <td>
                          <div className="pd-docname">
                            <span className="pd-docavatar">{initials(p)}</span>
                            <div>
                              <div className="pd-strong">{p.first_name} {p.last_name}</div>
                              <div className="pd-sub">{p.email || "Contact non renseigné"}</div>
                            </div>
                          </div>
                        </td>
                        <td>{p.national_id || <span className="pd-muted">—</span>}</td>
                        <td className="pd-nowrap">{age !== null ? `${age} ans` : "—"}</td>
                        <td>{sexLabel(p.sex)}</td>
                        <td>{p.blood_group && p.blood_group !== "unknown" ? p.blood_group : <span className="pd-muted">—</span>}</td>
                        <td className="pd-nowrap">{last ? fDate(last.scheduled_at) : <span className="pd-muted">Aucune</span>}</td>
                        <td className="pd-nowrap">{next ? <span className="pd-pill blue">{fDate(next.scheduled_at)} - {clock(String(next.scheduled_at))}</span> : <span className="pd-muted">Aucun</span>}</td>
                        <td className="pd-right">
                          <Link className="pd-btn pd-btn-ghost pd-btn-sm" href={`/doctor/patients/${p.id}`} onClick={(e) => e.stopPropagation()}>
                            <FolderOpen size={14} /> Dossier <ChevronRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </PatientShell>
  );
}
