"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays, CalendarPlus, Clock, FileText, FolderOpen, Pill, Receipt, ArrowRight, HeartPulse,
  ShieldCheck, ChevronRight, Download, Stethoscope,
} from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { parseLocal } from "@/components/PatientShell";

const APT: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Programmé", tone: "blue" },
  confirmed: { label: "Confirmé", tone: "green" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "grey" },
  no_show: { label: "Absence", tone: "red" },
};
const DOC_LABELS: Record<string, string> = {
  prescription: "Ordonnance", lab_result: "Analyse", xray: "Radiographie", mri: "IRM", ct_scan: "Scanner",
  ultrasound: "Échographie", operative_report: "Compte-rendu", consultation_note: "Compte-rendu", other: "Autre",
};

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fShort = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fTime = (iso: string) => parseLocal(String(iso)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const fLong = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

function inDays(iso: string) {
  const d = parseLocal(iso);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const n = Math.round((target.getTime() - start.getTime()) / 86400000);
  if (n <= 0) return "aujourd'hui";
  if (n === 1) return "demain";
  return `dans ${n} jours`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const patient = await api<any>("/patients/me");
        const [appts, cons, docs, inv, docList] = await Promise.all([
          api<any[]>("/appointments/mine").catch(() => []),
          api<any[]>(`/consultations/patient/${patient.id}`).catch(() => []),
          api<any[]>(`/documents/patient/${patient.id}`).catch(() => []),
          api<any[]>("/billing/invoices").catch(() => []),
          api<any[]>("/doctors").catch(() => []),
        ]);
        const rx = (
          await Promise.all(
            (cons ?? []).map((c: any) =>
              api<any[]>(`/consultations/${c.id}/prescriptions`)
                .then((list) => (list ?? []).map((r) => ({ ...r, _date: c.consultation_date })))
                .catch(() => [])
            )
          )
        ).flat();
        setMe(patient);
        setAppointments(appts ?? []);
        setDocuments(docs ?? []);
        setInvoices((inv ?? []).filter((i: any) => i.patient_id === patient.id));
        setDoctors(docList ?? []);
        setPrescriptions(rx);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger votre espace.");
      }
    })();
  }, [router]);

  const now = Date.now();
  const doctorName = (id?: string) => {
    const d = doctors.find((x) => x.id === id);
    return d ? `Dr. ${d.first_name} ${d.last_name}` : "Votre médecin";
  };
  const upcoming = appointments
    .filter((a) => t(a.scheduled_at) >= now && a.status !== "cancelled")
    .sort((a, b) => t(a.scheduled_at) - t(b.scheduled_at));
  const next = upcoming[0];
  const lastVisit = appointments
    .filter((a) => t(a.scheduled_at) < now && a.status !== "cancelled")
    .sort((a, b) => t(b.scheduled_at) - t(a.scheduled_at))[0];
  const docsSorted = [...documents].sort((a, b) => t(b.document_date ?? b.created_at) - t(a.document_date ?? a.created_at));
  const rxSorted = [...prescriptions].sort((a, b) => t(b._date ?? "1970-01-01") - t(a._date ?? "1970-01-01"));
  const pending = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const ordonnances = prescriptions.length + documents.filter((d) => d.category === "prescription").length;

  const firstName = me?.first_name ?? "";
  const hour = new Date().getHours();
  const hello = hour < 18 ? "Bonjour" : "Bonsoir";
  const pill = (label: string, tone: string) => <span className={`pd-pill ${tone}`}>{label}</span>;

  async function openFile(docId: string) {
    try {
      const { url } = await api<{ url: string }>(`/documents/${docId}/view`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Téléchargement impossible.");
    }
  }

  return (
    <PatientShell
      active="/dashboard"
      status={error ? "error" : !me ? "loading" : "ready"}
      error={error}
      firstName={me?.first_name}
      lastName={me?.last_name}
      onSearch={(q) => router.push(`/dossier${q ? "#documents" : ""}`)}
      searchPlaceholder="Rechercher un médecin, un rendez-vous, un document…"
      notifCount={upcoming.length + pending.length}
    >
      {me && (
        <div className="pd">
          <div className="pd-grid">
            <div className="pd-col">
              <section className="pd-card pd-headcard">
                <div className="pd-head">
                  <div className="pd-id">
                    <p className="pd-kicker">{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
                    <h1 className="pd-name pd-hello">{hello}, {firstName}</h1>
                    <p className="pd-lead">
                      {next
                        ? <>Votre prochain rendez-vous est <b>{inDays(next.scheduled_at)}</b>, {fLong(next.scheduled_at)} à {fTime(next.scheduled_at)}.</>
                        : "Vous n'avez aucun rendez-vous prévu. Pensez à planifier votre prochain suivi."}
                    </p>
                    <div className="pd-head-btns pd-head-btns-left">
                      <Link className="pd-btn pd-btn-primary" href="/rendez-vous"><CalendarPlus size={16} /> Prendre un rendez-vous</Link>
                      <Link className="pd-btn pd-btn-ghost" href="/dossier"><FolderOpen size={16} /> Voir mon dossier</Link>
                    </div>
                  </div>
                  <div className="pd-side">
                    <div className="pd-care">
                      <span className="pd-care-ic"><HeartPulse size={22} /></span>
                      <div>
                        <b>Prenez soin de votre santé</b>
                        <p>Votre dossier médical est sécurisé et accessible à tout moment.</p>
                      </div>
                    </div>
                    <div className="pd-care pd-care-soft">
                      <span className="pd-care-ic"><Stethoscope size={20} /></span>
                      <div>
                        <b>Dernière visite</b>
                        <p>{lastVisit ? `${fShort(lastVisit.scheduled_at)}, ${doctorName(lastVisit.doctor_id)}` : "Aucune visite enregistrée pour le moment."}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head">
                  <h2><CalendarDays size={22} /> Prochain rendez-vous</h2>
                  <Link className="pd-link" href="/rendez-vous">Voir tous <ArrowRight size={14} /></Link>
                </div>
                {next ? (
                  <div className="pd-next">
                    <div className="pd-datebox">
                      <b>{parseLocal(next.scheduled_at).getDate()}</b>
                      <span>{parseLocal(next.scheduled_at).toLocaleDateString("fr-FR", { month: "short" })}</span>
                      <small>{parseLocal(next.scheduled_at).getFullYear()}</small>
                    </div>
                    <div className="pd-next-time"><Clock size={16} /> {fTime(next.scheduled_at)}</div>
                    <div className="pd-next-what">
                      <b>{next.reason || "Consultation générale"}</b>
                      <span>{doctorName(next.doctor_id)}</span>
                    </div>
                    {pill(APT[next.status]?.label ?? next.status, APT[next.status]?.tone ?? "grey")}
                    <Link className="pd-btn pd-btn-ghost pd-btn-sm" href="/rendez-vous">Voir le détail</Link>
                    <ChevronRight size={18} className="pd-muted" />
                  </div>
                ) : (
                  <div className="pd-empty">
                    Aucun rendez-vous prévu. <Link className="pd-link" href="/rendez-vous">Prendre un rendez-vous</Link>
                  </div>
                )}
              </section>

              <div className="pd-stats">
                <Link className="pd-stat blue" href="/rendez-vous">
                  <span className="pd-stat-ic"><CalendarDays size={20} /></span>
                  <b>{upcoming.length}</b>
                  <span>Rendez-vous à venir</span>
                  <em>Voir mes rendez-vous <ArrowRight size={13} /></em>
                </Link>
                <Link className="pd-stat green" href="/dossier#documents">
                  <span className="pd-stat-ic"><FileText size={20} /></span>
                  <b>{documents.length}</b>
                  <span>Documents dans mon dossier</span>
                  <em>Voir mes documents <ArrowRight size={13} /></em>
                </Link>
                <Link className="pd-stat violet" href="/dossier#ordonnances">
                  <span className="pd-stat-ic"><Pill size={20} /></span>
                  <b>{ordonnances}</b>
                  <span>Ordonnances</span>
                  <em>Voir mes ordonnances <ArrowRight size={13} /></em>
                </Link>
                <Link className="pd-stat orange" href="/dossier#factures">
                  <span className="pd-stat-ic"><Receipt size={20} /></span>
                  <b>{pending.length}</b>
                  <span>Facture{pending.length > 1 ? "s" : ""} en attente</span>
                  <em>Voir mes factures <ArrowRight size={13} /></em>
                </Link>
              </div>

              <div className="pd-two">
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head">
                    <h2><CalendarDays size={22} /> Mes rendez-vous à venir</h2>
                  </div>
                  {upcoming.length === 0 ? (
                    <div className="pd-empty">Aucun rendez-vous à venir.</div>
                  ) : (
                    upcoming.slice(0, 4).map((a) => (
                      <div className="pd-row" key={a.id}>
                        <div className="pd-datebox pd-datebox-sm">
                          <b>{parseLocal(a.scheduled_at).getDate()}</b>
                          <span>{parseLocal(a.scheduled_at).toLocaleDateString("fr-FR", { month: "short" })}</span>
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div className="pd-strong">{a.reason || "Consultation"}</div>
                          <div className="pd-sub">{fTime(a.scheduled_at)}, {doctorName(a.doctor_id)}</div>
                        </div>
                        {pill(APT[a.status]?.label ?? a.status, APT[a.status]?.tone ?? "grey")}
                      </div>
                    ))
                  )}
                </section>

                <section className="pd-card pd-sec">
                  <div className="pd-sec-head">
                    <h2><Pill size={22} /> Ordonnances récentes</h2>
                    <Link className="pd-link" href="/dossier#ordonnances">Voir tout <ArrowRight size={14} /></Link>
                  </div>
                  {rxSorted.length === 0 ? (
                    <div className="pd-empty">Vos ordonnances apparaîtront ici après vos consultations.</div>
                  ) : (
                    rxSorted.slice(0, 4).map((r) => (
                      <div className="pd-row" key={r.id}>
                        <span className="pd-ic violet"><Pill size={17} /></span>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <div className="pd-strong">{r.medication_name}{r.dosage ? `, ${r.dosage}` : ""}</div>
                          <div className="pd-sub">{[r.instructions, r.duration].filter(Boolean).join(", ") || "Selon la prescription"}</div>
                        </div>
                        {r._date && <span className="pd-sub pd-nowrap">{fShort(r._date)}</span>}
                      </div>
                    ))
                  )}
                </section>
              </div>
            </div>

            <div className="pd-col">
              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><ArrowRight size={22} /> Accès rapides</h2></div>
                <div className="pd-quick">
                  <Link href="/rendez-vous"><span className="pd-ic blue"><CalendarPlus size={20} /></span>Prendre un rendez-vous</Link>
                  <Link href="/dossier"><span className="pd-ic green"><FolderOpen size={20} /></span>Mon dossier médical</Link>
                  <Link href="/dossier#documents"><span className="pd-ic violet"><FileText size={20} /></span>Mes documents</Link>
                  <Link href="/dossier#factures"><span className="pd-ic orange"><Receipt size={20} /></span>Mes factures</Link>
                </div>
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head">
                  <h2><FileText size={22} /> Derniers documents</h2>
                  <Link className="pd-link" href="/dossier#documents">Voir tout</Link>
                </div>
                {docsSorted.length === 0 ? (
                  <div className="pd-empty">Aucun document pour le moment.</div>
                ) : (
                  docsSorted.slice(0, 4).map((d) => (
                    <div className="pd-row" key={d.id}>
                      <span className="pd-ic red"><FileText size={17} /></span>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div className="pd-strong pd-ellipsis">{d.title}</div>
                        <div className="pd-sub">{DOC_LABELS[d.category] ?? d.category}, {fShort(d.document_date ?? d.created_at)}</div>
                      </div>
                      <button className="pd-icon-btn" title="Télécharger" aria-label="Télécharger" onClick={() => openFile(d.id)}><Download size={16} /></button>
                    </div>
                  ))
                )}
              </section>

              <section className="pd-card pd-secure">
                <span className="pd-secure-ic"><ShieldCheck size={30} /></span>
                <div>
                  <b>Un espace personnel et sécurisé</b>
                  <p>Vos données de santé sont protégées conformément aux normes en vigueur.</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </PatientShell>
  );
}
