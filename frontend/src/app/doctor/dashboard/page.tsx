"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus, CalendarDays, Clock, ArrowRight, Users, FileText, Pill, FlaskConical, TriangleAlert, FileCheck,
  CalendarClock, ChevronRight, Activity,
} from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal, clock } from "@/components/PatientShell";

const STATUS: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Programmé", tone: "blue" },
  confirmed: { label: "Confirmé", tone: "green" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "grey" },
  no_show: { label: "Absence", tone: "red" },
};

const REASON_GROUPS: { id: string; label: string; color: string; match: RegExp }[] = [
  { id: "consult", label: "Consultations", color: "#1877e0", match: /consult/i },
  { id: "suivi", label: "Suivis", color: "#8b6cf0", match: /suivi/i },
  { id: "controle", label: "Contrôles", color: "#f59e3d", match: /contr[oô]le/i },
  { id: "urgence", label: "Urgences", color: "#e5484d", match: /urgen/i },
  { id: "autre", label: "Autres", color: "#34c38f", match: /.*/ },
];

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fDate = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

function ageOf(dob?: string) {
  if (!dob) return null;
  const d = parseLocal(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptionCount, setPrescriptionCount] = useState(0);
  const [prescriptionsMonth, setPrescriptionsMonth] = useState(0);
  const [labDocs, setLabDocs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const [profile, apts, pats] = await Promise.all([
          api<any>("/doctors/me").catch(() => null),
          api<any[]>("/appointments/mine").catch(() => []),
          api<any[]>("/patients/").catch(() => []),
        ]);
        setMe(profile);
        setAppointments(apts ?? []);
        setPatients(pats ?? []);
        setLoading(false);

        // Détail de l'activité : consultations, ordonnances et analyses du cabinet.
        const list = (pats ?? []).slice(0, 60);
        const [consLists, docLists] = await Promise.all([
          Promise.all(list.map((p: any) => api<any[]>(`/consultations/patient/${p.id}`).catch(() => []))),
          Promise.all(list.map((p: any) => api<any[]>(`/documents/patient/${p.id}`).catch(() => []))),
        ]);
        const mine = consLists.flat().filter((c: any) => !profile?.id || c.doctor_id === profile.id);
        setConsultations(mine);
        setLabDocs(docLists.flat().filter((d: any) => d.category === "lab_result"));
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        const rxLists = await Promise.all(mine.map((c: any) => api<any[]>(`/consultations/${c.id}/prescriptions`).catch(() => [])));
        setPrescriptionCount(rxLists.flat().length);
        setPrescriptionsMonth(
          rxLists.reduce((n, l, i) => n + (t(mine[i].consultation_date) >= monthStart ? (l ?? []).length : 0), 0)
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger votre activité.");
        setLoading(false);
      }
    })();
  }, [router]);

  const now = new Date();
  const nowMs = now.getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const weekAgo = nowMs - 7 * 86400000;
  const isToday = (iso: string) => parseLocal(iso).toDateString() === now.toDateString();

  const sorted = [...appointments].filter((a) => a.scheduled_at).sort((a, b) => t(a.scheduled_at) - t(b.scheduled_at));
  const today = sorted.filter((a) => isToday(a.scheduled_at) && a.status !== "cancelled");
  const upcoming = sorted.filter((a) => t(a.scheduled_at) >= nowMs && a.status !== "cancelled");
  const nextOne = upcoming[0];
  const toConfirm = upcoming.filter((a) => a.status === "scheduled");

  const patient = (id: string) => patients.find((x) => x.id === id);
  const patientName = (id: string) => {
    const p = patient(id);
    return p ? `${p.first_name} ${p.last_name}` : "Patient";
  };

  const consMonth = consultations.filter((c) => t(c.consultation_date) >= monthStart).length;
  const labMonth = labDocs.filter((d) => t(d.document_date ?? d.created_at) >= monthStart).length;
  const labWeek = labDocs.filter((d) => t(d.document_date ?? d.created_at) >= weekAgo).length;
  const newPatientsMonth = patients.filter((p) => {
    const first = sorted.find((a) => a.patient_id === p.id);
    return first && t(first.scheduled_at) >= monthStart;
  }).length;

  const reasonSource = consultations.length > 0
    ? consultations.map((c) => c.reason || "")
    : sorted.filter((a) => a.status !== "cancelled").map((a) => a.reason || "");
  const reasonCounts = REASON_GROUPS.map((g) => ({ ...g, n: 0 }));
  reasonSource.forEach((r) => {
    const idx = REASON_GROUPS.findIndex((g) => g.id !== "autre" && g.match.test(r));
    reasonCounts[idx === -1 ? REASON_GROUPS.length - 1 : idx].n++;
  });
  const reasonTotal = reasonSource.length;
  let acc = 0;
  const donut = reasonTotal === 0
    ? "#e1eaf3 0deg 360deg"
    : reasonCounts.filter((c) => c.n > 0).map((c) => {
        const from = (acc / reasonTotal) * 360;
        acc += c.n;
        return `${c.color} ${from}deg ${(acc / reasonTotal) * 360}deg`;
      }).join(", ");

  const lastVisit = (pid: string) => {
    const past = sorted.filter((a) => a.patient_id === pid && t(a.scheduled_at) <= nowMs && a.status !== "cancelled");
    return past.length ? past[past.length - 1].scheduled_at : null;
  };
  const recentPatients = [...patients]
    .map((p) => ({ p, last: lastVisit(p.id) }))
    .sort((a, b) => (b.last ? t(b.last) : 0) - (a.last ? t(a.last) : 0))
    .slice(0, 5);
  const inactive30 = patients.filter((p) => {
    const hasUpcoming = upcoming.some((a) => a.patient_id === p.id);
    const last = lastVisit(p.id);
    return !hasUpcoming && (!last || t(last) < nowMs - 30 * 86400000);
  }).length;

  const agenda = today.length > 0 ? today : upcoming.slice(0, 5);
  const initials = (p: any) => `${(p?.first_name ?? "?")[0]}${(p?.last_name ?? "")[0] ?? ""}`.toUpperCase();
  const pill = (status: string) => {
    const s = STATUS[status] ?? { label: status, tone: "grey" };
    return <span className={`pd-pill ${s.tone}`}>{s.label}</span>;
  };

  function search(q: string) {
    const s = q.toLowerCase();
    if (!s) return router.push("/doctor/patients");
    const found = patients.filter((p) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) ||
      `${p.last_name} ${p.first_name}`.toLowerCase().includes(s) ||
      (p.national_id || "").toLowerCase().includes(s)
    );
    router.push(found.length === 1 ? `/doctor/patients/${found[0].id}` : "/doctor/patients");
  }

  return (
    <PatientShell
      active="/doctor/dashboard"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin généraliste"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me?.first_name}
      lastName={me?.last_name}
      onSearch={search}
      searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
      notifCount={toConfirm.length + labWeek}
    >
      <div className="pd dd">
        <div className="dd-top">
          <div className="dd-hello">
            <div className="dd-hello-row">
              <div>
                <h1 className="pd-name pd-hello">Bonjour Dr. {me?.first_name} {me?.last_name} <span aria-hidden="true">👋</span></h1>
                <p className="pd-sub" style={{ fontSize: 14 }}>Voici un aperçu de votre activité aujourd&apos;hui.</p>
              </div>
              <Link className="pd-btn pd-btn-primary" href="/doctor/patients"><Plus size={16} /> Nouvelle consultation</Link>
            </div>

            <div className="dd-stats">
              <Link className="dd-stat" href="/doctor/patients">
                <span className="dd-stat-ic green"><Users size={20} /></span>
                <span className="dd-stat-body">
                  <span className="dd-stat-k">Mes patients</span>
                  <b>{patients.length}</b>
                  <em>+{newPatientsMonth} ce mois</em>
                </span>
              </Link>
              <div className="dd-stat">
                <span className="dd-stat-ic violet"><FileText size={20} /></span>
                <span className="dd-stat-body">
                  <span className="dd-stat-k">Consultations</span>
                  <b>{consultations.length}</b>
                  <em>+{consMonth} ce mois</em>
                </span>
              </div>
              <div className="dd-stat">
                <span className="dd-stat-ic orange"><Pill size={20} /></span>
                <span className="dd-stat-body">
                  <span className="dd-stat-k">Ordonnances</span>
                  <b>{prescriptionCount}</b>
                  <em>+{prescriptionsMonth} ce mois</em>
                </span>
              </div>
              <div className="dd-stat">
                <span className="dd-stat-ic blue"><FlaskConical size={20} /></span>
                <span className="dd-stat-body">
                  <span className="dd-stat-k">Analyses</span>
                  <b>{labDocs.length}</b>
                  <em>+{labMonth} ce mois</em>
                </span>
              </div>
            </div>
          </div>

          <section className="pd-card dd-next">
            <div className="dd-next-head"><CalendarDays size={18} /> Prochain rendez-vous</div>
            {nextOne ? (
              <>
                <div className="dd-next-time"><Clock size={16} /> {clock(String(nextOne.scheduled_at))} - {patientName(nextOne.patient_id)}</div>
                <div className="pd-sub">
                  {isToday(nextOne.scheduled_at) ? "Aujourd'hui" : parseLocal(nextOne.scheduled_at).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}, {nextOne.reason || "Consultation générale"}
                </div>
              </>
            ) : (
              <div className="pd-sub">Aucun rendez-vous à venir.</div>
            )}
            <a className="pd-btn pd-btn-primary dd-next-btn" href="#agenda">Voir le planning <ArrowRight size={15} /></a>
          </section>
        </div>

        <div className="dd-grid">
          <section className="pd-card pd-sec" id="agenda">
            <div className="pd-sec-head">
              <h2><CalendarDays size={20} /> {today.length > 0 ? "Rendez-vous d'aujourd'hui" : "Prochains rendez-vous"}</h2>
              <Link className="pd-link" href="/doctor/patients">Voir tous <ArrowRight size={14} /></Link>
            </div>
            {agenda.length === 0 ? (
              <div className="pd-empty">Aucun rendez-vous prévu.</div>
            ) : (
              <div className="pd-scroll">
                <table className="pd-table">
                  <thead><tr><th>Heure</th><th>Patient</th><th>Motif</th><th>Statut</th></tr></thead>
                  <tbody>
                    {agenda.map((a) => (
                      <tr key={a.id} className="pd-click" onClick={() => router.push(`/doctor/patients/${a.patient_id}`)}>
                        <td className="pd-nowrap">
                          {today.length === 0 && <span className="pd-sub" style={{ display: "block", marginTop: 0 }}>{parseLocal(a.scheduled_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>}
                          {clock(String(a.scheduled_at))}
                        </td>
                        <td className="pd-strong">{patientName(a.patient_id)}</td>
                        <td>{a.reason || "Consultation"}</td>
                        <td>{pill(a.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="pd-card pd-sec">
            <div className="pd-sec-head"><h2><Activity size={20} /> Répartition des consultations</h2></div>
            <div className="pd-donut-wrap">
              <div className="pd-donut dd-donut" style={{ background: `conic-gradient(${donut})` }}>
                <div className="pd-donut-hole dd-donut-hole"><b>{reasonTotal}</b><span>Total</span></div>
              </div>
              <ul className="pd-legend">
                {reasonCounts.map((c) => (
                  <li key={c.id}>
                    <i style={{ background: c.color }} />
                    <span style={{ flexGrow: 1 }}>{c.label}</span>
                    <b>{reasonTotal ? Math.round((c.n / reasonTotal) * 100) : 0}%</b>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="pd-card pd-sec">
            <div className="pd-sec-head">
              <h2><Users size={20} /> Mes patients récents</h2>
              <Link className="pd-link" href="/doctor/patients">Voir tous <ArrowRight size={14} /></Link>
            </div>
            {recentPatients.length === 0 ? (
              <div className="pd-empty">Aucun patient pour le moment.</div>
            ) : (
              recentPatients.map(({ p, last }) => {
                const age = ageOf(p.date_of_birth);
                return (
                  <Link key={p.id} className="dd-patient" href={`/doctor/patients/${p.id}`}>
                    <span className="pd-docavatar">{initials(p)}</span>
                    <span className="pd-strong dd-pname">{p.first_name} {p.last_name}</span>
                    <span className="pd-sub dd-pcin">CIN : {p.national_id || "—"}</span>
                    <span className="pd-sub dd-page">{age !== null ? `${age} ans` : "—"}</span>
                    <span className="pd-sub dd-plast">{last ? `Dernière visite : ${fDate(last)}` : "Aucune visite"}</span>
                    <ChevronRight size={16} className="pd-muted" />
                  </Link>
                );
              })
            )}
          </section>

          <section className="pd-card pd-sec">
            <div className="pd-sec-head"><h2><TriangleAlert size={20} /> Alertes médicales</h2></div>
            <ul className="dd-alerts">
              <li>
                <span className="pd-ic blue"><CalendarClock size={17} /></span>
                <span>{toConfirm.length} rendez-vous programmé{toConfirm.length > 1 ? "s" : ""} en attente de confirmation</span>
              </li>
              <li>
                <span className="pd-ic violet"><FileCheck size={17} /></span>
                <span>{labWeek} résultat{labWeek > 1 ? "s" : ""} d&apos;analyse ajouté{labWeek > 1 ? "s" : ""} cette semaine</span>
              </li>
              <li>
                <span className="pd-ic red"><TriangleAlert size={17} /></span>
                <span>{inactive30} patient{inactive30 > 1 ? "s" : ""} sans rendez-vous depuis 30 jours</span>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </PatientShell>
  );
}
