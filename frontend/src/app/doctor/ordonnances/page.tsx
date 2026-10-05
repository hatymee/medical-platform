"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pill, Search, CalendarDays, Users, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal } from "@/components/PatientShell";

type Filter = "all" | "month" | "week";

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fDate = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function DoctorOrdonnancesPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
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
        const consLists = await Promise.all(
          (pats ?? []).map((p: any) => api<any[]>(`/consultations/patient/${p.id}`).catch(() => []))
        );
        const mine = consLists.flat().filter((c: any) => !profile?.id || c.doctor_id === profile.id);
        const rxLists = await Promise.all(mine.map((c: any) => api<any[]>(`/consultations/${c.id}/prescriptions`).catch(() => [])));
        const flat = mine.flatMap((c, i) => (rxLists[i] ?? []).map((r) => ({ ...r, _consultation: c })));
        setRows(flat);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger vos ordonnances.");
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

  const sorted = [...rows].sort((a, b) => t(b._consultation.consultation_date) - t(a._consultation.consultation_date));
  const thisMonth = sorted.filter((r) => t(r._consultation.consultation_date) >= monthStart);
  const thisWeek = sorted.filter((r) => t(r._consultation.consultation_date) >= weekAgo);
  const distinctPatients = new Set(rows.map((r) => r._consultation.patient_id)).size;

  const base = filter === "month" ? thisMonth : filter === "week" ? thisWeek : sorted;
  const q = query.trim().toLowerCase();
  const shown = base.filter(
    (r) => !q || `${patientName(r._consultation.patient_id)} ${r.medication_name ?? ""}`.toLowerCase().includes(q)
  );

  return (
    <PatientShell
      active="/doctor/ordonnances"
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
            <h1 className="pd-name pd-hello">Ordonnances</h1>
            <p className="pd-sub" style={{ fontSize: 14 }}>Toutes vos prescriptions, tous patients confondus.</p>
          </div>
        </div>

        <div className="dd-stats dd-stats-3" style={{ marginBottom: 18 }}>
          <div className="dd-stat">
            <span className="dd-stat-ic orange"><Pill size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Total ordonnances</span><b>{rows.length}</b><em>depuis le début</em></span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-ic blue"><CalendarDays size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Ce mois-ci</span><b>{thisMonth.length}</b><em>{thisWeek.length} cette semaine</em></span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-ic green"><Users size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Patients concernés</span><b>{distinctPatients}</b><em>patients distincts</em></span>
          </div>
        </div>

        <section className="pd-card pd-sec">
          <div className="pd-sec-head"><h2><Pill size={20} /> Historique des prescriptions</h2></div>
          <div className="pd-toolbar">
            <div className="pd-chips">
              <button className={`pd-chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")}>Toutes <em>{sorted.length}</em></button>
              <button className={`pd-chip ${filter === "month" ? "on" : ""}`} onClick={() => setFilter("month")}>Ce mois-ci <em>{thisMonth.length}</em></button>
              <button className={`pd-chip ${filter === "week" ? "on" : ""}`} onClick={() => setFilter("week")}>Cette semaine <em>{thisWeek.length}</em></button>
            </div>
            <div className="pd-search">
              <Search size={16} />
              <input placeholder="Patient ou médicament" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="pd-empty">{rows.length === 0 ? "Aucune prescription enregistrée pour le moment." : "Aucune ordonnance ne correspond."}</div>
          ) : (
            <div className="pd-scroll">
              <table className="pd-table">
                <thead><tr><th>Patient</th><th>Médicament</th><th>Posologie</th><th>Durée</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.id} className="pd-click" onClick={() => router.push(`/doctor/patients/${r._consultation.patient_id}`)}>
                      <td>
                        <div className="pd-docname">
                          <span className="pd-docavatar">{patientInitials(r._consultation.patient_id)}</span>
                          <span className="pd-strong">{patientName(r._consultation.patient_id)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="pd-docname"><span className="pd-ic orange"><Pill size={16} /></span><span className="pd-strong">{r.medication_name}</span></div>
                      </td>
                      <td>{r.dosage || "—"}</td>
                      <td>{r.duration || "—"}</td>
                      <td className="pd-nowrap">{fDate(r._consultation.consultation_date)}</td>
                      <td className="pd-right">
                        <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={(e) => { e.stopPropagation(); router.push(`/doctor/patients/${r._consultation.patient_id}`); }}>
                          Dossier <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="pd-hint">Pour prescrire un nouveau médicament, ouvrez le dossier du patient concerné.</p>
        </section>
      </div>
    </PatientShell>
  );
}
