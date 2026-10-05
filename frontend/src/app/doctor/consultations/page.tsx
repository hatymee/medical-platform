"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, Search, CalendarDays, Users, ChevronRight, Plus } from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal } from "@/components/PatientShell";

type Filter = "all" | "month" | "week";

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fDate = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function DoctorConsultationsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
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
        const [profile, pats] = await Promise.all([
          api<any>("/doctors/me").catch(() => null),
          api<any[]>("/patients/").catch(() => []),
        ]);
        setMe(profile);
        setPatients(pats ?? []);
        const lists = await Promise.all(
          (pats ?? []).map((p: any) => api<any[]>(`/consultations/patient/${p.id}`).catch(() => []))
        );
        const mine = lists.flat().filter((c: any) => !profile?.id || c.doctor_id === profile.id);
        setConsultations(mine);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger vos consultations.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const weekAgo = now - 7 * 86400000;
  const patientName = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Patient";
  };
  const patientInitials = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${(p.first_name ?? "?")[0]}${(p.last_name ?? "")[0] ?? ""}`.toUpperCase() : "?";
  };

  const sorted = [...consultations].sort((a, b) => t(b.consultation_date) - t(a.consultation_date));
  const thisMonth = sorted.filter((c) => t(c.consultation_date) >= monthStart);
  const thisWeek = sorted.filter((c) => t(c.consultation_date) >= weekAgo);
  const distinctPatients = new Set(consultations.map((c) => c.patient_id)).size;

  const base = filter === "month" ? thisMonth : filter === "week" ? thisWeek : sorted;
  const q = query.trim().toLowerCase();
  const shown = base.filter((c) => !q || `${patientName(c.patient_id)} ${c.reason ?? ""}`.toLowerCase().includes(q));

  return (
    <PatientShell
      active="/doctor/consultations"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin généraliste"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me?.first_name}
      lastName={me?.last_name}
      onSearch={(s) => { setQuery(s); setFilter("all"); }}
      searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
    >
      <div className="pd dd">
        <div className="dd-hello-row">
          <div>
            <h1 className="pd-name pd-hello">Consultations</h1>
            <p className="pd-sub" style={{ fontSize: 14 }}>Toutes vos consultations, tous patients confondus.</p>
          </div>
        </div>

        <div className="dd-stats dd-stats-3" style={{ marginBottom: 18 }}>
          <div className="dd-stat">
            <span className="dd-stat-ic violet"><Stethoscope size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Total consultations</span><b>{consultations.length}</b><em>depuis le début</em></span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-ic blue"><CalendarDays size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Ce mois-ci</span><b>{thisMonth.length}</b><em>{thisWeek.length} cette semaine</em></span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-ic green"><Users size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Patients vus</span><b>{distinctPatients}</b><em>patients distincts</em></span>
          </div>
        </div>

        <section className="pd-card pd-sec">
          <div className="pd-sec-head"><h2><Stethoscope size={20} /> Historique des consultations</h2></div>
          <div className="pd-toolbar">
            <div className="pd-chips">
              <button className={`pd-chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>Toutes <em>{sorted.length}</em></button>
              <button className={`pd-chip ${filter === "month" ? "on" : ""}`} onClick={() => setFilter("month")}>Ce mois-ci <em>{thisMonth.length}</em></button>
              <button className={`pd-chip ${filter === "week" ? "on" : ""}`} onClick={() => setFilter("week")}>Cette semaine <em>{thisWeek.length}</em></button>
            </div>
            <div className="pd-search">
              <Search size={16} />
              <input placeholder="Patient ou motif" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="pd-empty">{consultations.length === 0 ? "Aucune consultation enregistrée pour le moment." : "Aucune consultation ne correspond."}</div>
          ) : (
            <div className="pd-scroll">
              <table className="pd-table">
                <thead><tr><th>Patient</th><th>Motif</th><th>Observations</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {shown.map((c) => (
                    <tr key={c.id} className="pd-click" onClick={() => router.push(`/doctor/patients/${c.patient_id}`)}>
                      <td>
                        <div className="pd-docname">
                          <span className="pd-docavatar">{patientInitials(c.patient_id)}</span>
                          <span className="pd-strong">{patientName(c.patient_id)}</span>
                        </div>
                      </td>
                      <td>{c.reason || "Consultation"}</td>
                      <td className="pd-ellipsis" style={{ maxWidth: 260, display: "block" }}>{c.notes || <span className="pd-muted">—</span>}</td>
                      <td className="pd-nowrap">{fDate(c.consultation_date)}</td>
                      <td className="pd-right">
                        <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={(e) => { e.stopPropagation(); router.push(`/doctor/patients/${c.patient_id}`); }}>
                          Dossier <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pd-hint">Pour ajouter une consultation ou une prescription, ouvrez le dossier du patient concerné.</p>
        </section>
      </div>
    </PatientShell>
  );
}
