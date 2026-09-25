"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowRight, Home, CalendarDays, Pill, FlaskConical, FileText, Receipt, History, Clock,
  CreditCard, User, Phone, Mail, MapPin, Pencil, HeartPulse, Download, Eye, ShieldCheck, Info, X,
  ScanLine, Stethoscope, ChevronRight, Search,
} from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { parseLocal } from "@/components/PatientShell";
import DocumentViewer from "@/components/DocumentViewer";

type Tab = "overview" | "rdv" | "ordonnances" | "analyses" | "documents" | "factures" | "historique";
type Group = "all" | "prescription" | "lab" | "report" | "imaging" | "other";

const DOC_LABELS: Record<string, string> = {
  prescription: "Ordonnance", lab_result: "Analyse", xray: "Radiographie", mri: "IRM", ct_scan: "Scanner",
  ultrasound: "Échographie", operative_report: "Compte-rendu", consultation_note: "Compte-rendu", other: "Autre",
};
const GROUP_OF: Record<string, Group> = {
  prescription: "prescription", lab_result: "lab", operative_report: "report", consultation_note: "report",
  xray: "imaging", mri: "imaging", ct_scan: "imaging", ultrasound: "imaging", other: "other",
};
const GROUPS: { id: Exclude<Group, "all">; label: string; color: string; tone: string; icon: typeof FileText }[] = [
  { id: "prescription", label: "Ordonnances", color: "#1877e0", tone: "green", icon: Pill },
  { id: "lab", label: "Analyses", color: "#8b6cf0", tone: "violet", icon: FlaskConical },
  { id: "report", label: "Comptes-rendus", color: "#7c93f5", tone: "blue", icon: FileText },
  { id: "imaging", label: "Imagerie", color: "#f59e3d", tone: "orange", icon: ScanLine },
  { id: "other", label: "Autres", color: "#34c38f", tone: "grey", icon: FileText },
];
const APT: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Programmé", tone: "blue" },
  confirmed: { label: "Confirmé", tone: "green" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "grey" },
  no_show: { label: "Absence", tone: "red" },
};
const INV: Record<string, { label: string; tone: string }> = {
  paid: { label: "Payée", tone: "green" },
  partial: { label: "Partielle", tone: "amber" },
  unpaid: { label: "À régler", tone: "red" },
  cancelled: { label: "Annulée", tone: "grey" },
};
const BLOOD = ["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fShort = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fDate = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const fTime = (iso: string) => parseLocal(String(iso)).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const money = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(Number(v ?? 0));
const groupOf = (c: string): Exclude<Group, "all"> => (GROUP_OF[c] ?? "other") as Exclude<Group, "all">;
const gMeta = (g: Exclude<Group, "all">) => GROUPS.find((x) => x.id === g)!;

function ageOf(dob?: string) {
  if (!dob) return null;
  const d = parseLocal(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

function tabFromHash(): Tab {
  if (typeof window === "undefined") return "overview";
  const h = window.location.hash.replace("#", "");
  return (["rdv", "ordonnances", "analyses", "documents", "factures", "historique"].includes(h) ? h : "overview") as Tab;
}

export default function DossierPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [tab, setTabState] = useState<Tab>("overview");
  const [group, setGroup] = useState<Group>("all");
  const [docQuery, setDocQuery] = useState("");
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [edit, setEdit] = useState({ first_name: "", last_name: "", national_id: "", sex: "F", blood_group: "unknown", address: "" });
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const setTab = (next: Tab) => {
    setTabState(next);
    const hash = next === "overview" ? "" : `#${next}`;
    window.history.replaceState(null, "", `/dossier${hash}`);
  };

  const load = useCallback(async () => {
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
            .then((list) => (list ?? []).map((r) => ({ ...r, _date: c.consultation_date, _doctor: c.doctor_id })))
            .catch(() => [])
        )
      )
    ).flat();
    setMe(patient);
    setAppointments(appts ?? []);
    setConsultations(cons ?? []);
    setDocuments(docs ?? []);
    setInvoices((inv ?? []).filter((i: any) => i.patient_id === patient.id));
    setDoctors(docList ?? []);
    setPrescriptions(rx);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    load().catch((err) => setError(err instanceof Error ? err.message : "Impossible de charger le dossier médical."));
    setTabState(tabFromHash());
    const onHash = () => setTabState(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, [router, load]);

  const now = Date.now();
  const doctorName = (id?: string) => {
    const d = doctors.find((x) => x.id === id);
    return d ? `Dr. ${d.first_name} ${d.last_name}` : "Votre médecin";
  };
  const upcoming = appointments
    .filter((a) => t(a.scheduled_at) >= now && a.status !== "cancelled")
    .sort((a, b) => t(a.scheduled_at) - t(b.scheduled_at));
  const next = upcoming[0];
  const allAppts = [...appointments].sort((a, b) => t(b.scheduled_at) - t(a.scheduled_at));
  const sortedDocs = [...documents].sort((a, b) => t(b.document_date ?? b.created_at) - t(a.document_date ?? a.created_at));
  const docsIn = (g: Group) => sortedDocs.filter((d) => g === "all" || groupOf(d.category) === g);
  const q = docQuery.trim().toLowerCase();
  const filteredDocs = docsIn(group).filter((d) => !q || `${d.title} ${DOC_LABELS[d.category] ?? ""}`.toLowerCase().includes(q));
  const pendingInvoices = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const prescriptionDocs = docsIn("prescription");
  const ordonnanceCount = prescriptions.length + prescriptionDocs.length;

  const firstName = me?.first_name ?? "";
  const lastName = me?.last_name ?? "";
  const age = ageOf(me?.date_of_birth);
  const sexLabel = me?.sex === "M" || me?.sex === "male" ? "Homme" : me?.sex === "F" || me?.sex === "female" ? "Femme" : "Non renseigné";
  const active = tab === "documents" ? "/dossier#documents" : tab === "factures" ? "/dossier#factures" : "/dossier";

  const counts = GROUPS.map((g) => ({ ...g, n: docsIn(g.id).length }));
  const total = sortedDocs.length;
  let acc = 0;
  const donut = total === 0
    ? "#e1eaf3 0deg 360deg"
    : counts.filter((c) => c.n > 0).map((c) => {
        const from = (acc / total) * 360;
        acc += c.n;
        return `${c.color} ${from}deg ${(acc / total) * 360}deg`;
      }).join(", ");

  async function openFile(docId: string) {
    try {
      const { url } = await api<{ url: string }>(`/documents/${docId}/view`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Téléchargement impossible.");
    }
  }

  function openEdit() {
    setEdit({
      first_name: me?.first_name ?? "",
      last_name: me?.last_name ?? "",
      national_id: me?.national_id ?? "",
      sex: me?.sex === "M" || me?.sex === "male" ? "M" : "F",
      blood_group: me?.blood_group || "unknown",
      address: me?.address ?? "",
    });
    setEditError("");
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    if (!edit.first_name.trim() || !edit.last_name.trim()) {
      setEditError("Le nom et le prénom sont obligatoires.");
      return;
    }
    setEditSaving(true);
    try {
      await api("/patients/me", {
        method: "PATCH",
        body: JSON.stringify({
          first_name: edit.first_name.trim(),
          last_name: edit.last_name.trim(),
          national_id: edit.national_id.trim() || null,
          sex: edit.sex,
          blood_group: edit.blood_group,
          address: edit.address.trim() || null,
        }),
      });
      await load();
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEditSaving(false);
    }
  }

  const pill = (label: string, tone: string) => <span className={`pd-pill ${tone}`}>{label}</span>;

  const docTable = (list: any[], empty: string) =>
    list.length === 0 ? (
      <div className="pd-empty">{empty}</div>
    ) : (
      <div className="pd-scroll">
        <table className="pd-table">
          <thead>
            <tr><th>Nom du document</th><th>Type</th><th>Date d&apos;ajout</th><th className="pd-right">Actions</th></tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const g = gMeta(groupOf(d.category));
              return (
                <tr key={d.id}>
                  <td>
                    <div className="pd-docname">
                      <span className={`pd-ic ${g.tone}`}><g.icon size={18} /></span>
                      <span className="pd-strong">{d.title}</span>
                    </div>
                  </td>
                  <td>{pill(DOC_LABELS[d.category] ?? d.category, g.tone)}</td>
                  <td>{fShort(d.document_date ?? d.created_at)}</td>
                  <td>
                    <div className="pd-actions">
                      <button className="pd-icon-btn" title="Voir" aria-label="Voir" onClick={() => setViewDoc(d)}><Eye size={16} /></button>
                      <button className="pd-icon-btn" title="Télécharger" aria-label="Télécharger" onClick={() => openFile(d.id)}><Download size={16} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const apptTable = (list: any[]) =>
    list.length === 0 ? (
      <div className="pd-empty">Aucun rendez-vous pour le moment.</div>
    ) : (
      <div className="pd-scroll">
        <table className="pd-table">
          <thead><tr><th>Date &amp; Heure</th><th>Motif</th><th>Médecin</th><th>Statut</th></tr></thead>
          <tbody>
            {list.map((a) => {
              const s = APT[a.status] ?? { label: a.status, tone: "grey" };
              return (
                <tr key={a.id}>
                  <td className="pd-nowrap">{fShort(a.scheduled_at)} - {fTime(a.scheduled_at)}</td>
                  <td>{a.reason || "Consultation"}</td>
                  <td>{doctorName(a.doctor_id)}</td>
                  <td>{pill(s.label, s.tone)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const events = [
    ...appointments.map((a) => ({ k: `a${a.id}`, at: a.scheduled_at, icon: CalendarDays, tone: "blue", title: `Rendez-vous : ${a.reason || "Consultation"}`, sub: `${doctorName(a.doctor_id)}, ${(APT[a.status]?.label ?? a.status).toLowerCase()}` })),
    ...consultations.map((c) => ({ k: `c${c.id}`, at: c.consultation_date, icon: Stethoscope, tone: "green", title: `Consultation : ${c.reason || "Consultation médicale"}`, sub: doctorName(c.doctor_id) })),
    ...documents.map((d) => ({ k: `d${d.id}`, at: d.document_date ?? d.created_at, icon: FileText, tone: gMeta(groupOf(d.category)).tone, title: `Document ajouté : ${d.title}`, sub: DOC_LABELS[d.category] ?? d.category })),
    ...invoices.map((i) => ({ k: `i${i.id}`, at: i.issued_at, icon: Receipt, tone: INV[i.status]?.tone ?? "red", title: `Facture de ${money(i.amount_due)}`, sub: `${i.description}, ${(INV[i.status] ?? INV.unpaid).label.toLowerCase()}` })),
  ].filter((e) => e.at).sort((a, b) => t(b.at) - t(a.at));

  const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: "overview", label: "Vue générale", icon: Home },
    { id: "rdv", label: "Rendez-vous", icon: CalendarDays },
    { id: "ordonnances", label: "Ordonnances", icon: Pill },
    { id: "analyses", label: "Analyses", icon: FlaskConical },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "factures", label: "Factures", icon: Receipt },
    { id: "historique", label: "Historique", icon: History },
  ];

  const info: [string, string, typeof User][] = [
    ["Nom complet", `${firstName} ${lastName}`, User],
    ["CIN", me?.national_id || "Non renseigné", CreditCard],
    ["Date de naissance", me?.date_of_birth ? `${fDate(me.date_of_birth)}${age !== null ? ` (${age} ans)` : ""}` : "Non renseignée", CalendarDays],
    ["Sexe", sexLabel, User],
    ["Téléphone", me?.phone || "Non renseigné", Phone],
    ["Email", me?.email || "Non renseigné", Mail],
    ["Adresse", me?.address || "Non renseignée", MapPin],
  ];

  return (
    <PatientShell
      active={active}
      status={error ? "error" : !me ? "loading" : "ready"}
      error={error}
      firstName={firstName}
      lastName={lastName}
      onSearch={(query) => { setDocQuery(query); setGroup("all"); setTab("documents"); }}
      searchPlaceholder="Rechercher un médecin, un rendez-vous, un document…"
      notifCount={upcoming.length + pendingInvoices.length}
    >
      {me && (
        <div className="pd">
          <Link className="pd-back" href="/dashboard"><ArrowLeft size={16} /> Retour à l&apos;accueil</Link>

          <div className="pd-grid">
            <div className="pd-col">
              <section className="pd-card pd-headcard">
                <div className="pd-head">
                  <div className="pd-avatar"><User size={60} fill="currentColor" strokeWidth={1} /></div>
                  <div className="pd-id">
                    <h1 className="pd-name">{firstName} {lastName} {pill("Patient actif", "green")}</h1>
                    <div className="pd-meta">
                      <span><CreditCard size={15} /> CIN : {me.national_id || "non renseigné"}</span>
                      {age !== null && (<><i className="pd-dot" /><span>{age} ans</span></>)}
                      <i className="pd-dot" />
                      <span><User size={15} /> {sexLabel}</span>
                    </div>
                    <div className="pd-meta pd-contact">
                      {me.phone && <span><Phone size={16} /> {me.phone}</span>}
                      {me.email && <span><Mail size={16} /> {me.email}</span>}
                    </div>
                    <div className="pd-meta pd-contact">
                      <span><MapPin size={16} /> {me.address || "Adresse non renseignée"}</span>
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
                    <div className="pd-head-btns">
                      <Link className="pd-btn pd-btn-primary" href="/rendez-vous"><CalendarDays size={16} /> Prendre un rendez-vous</Link>
                      <button className="pd-btn pd-btn-ghost" onClick={() => window.print()}><Download size={16} /> Télécharger mon dossier</button>
                    </div>
                  </div>
                </div>
              </section>

              <nav className="pd-card pd-tabs" role="tablist">
                {TABS.map((x) => (
                  <button key={x.id} role="tab" aria-selected={tab === x.id} className={`pd-tab ${tab === x.id ? "on" : ""}`} onClick={() => setTab(x.id)}>
                    <x.icon size={18} /> {x.label}
                  </button>
                ))}
              </nav>

              {tab === "overview" && (
                <>
                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head">
                      <h2><CalendarDays size={22} /> Prochains rendez-vous</h2>
                      <button className="pd-link" onClick={() => setTab("rdv")}>Voir tous <ArrowRight size={14} /></button>
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
                        Aucun rendez-vous prévu.{" "}
                        <Link className="pd-link" href="/rendez-vous">Prendre un rendez-vous</Link>
                      </div>
                    )}
                  </section>

                  <div className="pd-stats">
                    <button className="pd-stat blue" onClick={() => setTab("rdv")}>
                      <span className="pd-stat-ic"><CalendarDays size={20} /></span>
                      <b>{upcoming.length}</b>
                      <span>Rendez-vous à venir</span>
                      <em>Voir mes rendez-vous <ArrowRight size={13} /></em>
                    </button>
                    <button className="pd-stat green" onClick={() => setTab("documents")}>
                      <span className="pd-stat-ic"><FileText size={20} /></span>
                      <b>{total}</b>
                      <span>Documents dans mon dossier</span>
                      <em>Voir mes documents <ArrowRight size={13} /></em>
                    </button>
                    <button className="pd-stat violet" onClick={() => setTab("ordonnances")}>
                      <span className="pd-stat-ic"><Pill size={20} /></span>
                      <b>{ordonnanceCount}</b>
                      <span>Ordonnances</span>
                      <em>Voir mes ordonnances <ArrowRight size={13} /></em>
                    </button>
                    <button className="pd-stat orange" onClick={() => setTab("factures")}>
                      <span className="pd-stat-ic"><Receipt size={20} /></span>
                      <b>{pendingInvoices.length}</b>
                      <span>Facture{pendingInvoices.length > 1 ? "s" : ""} en attente</span>
                      <em>Voir mes factures <ArrowRight size={13} /></em>
                    </button>
                  </div>

                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head">
                      <h2><FileText size={22} /> Mes derniers documents</h2>
                      <button className="pd-link" onClick={() => setTab("documents")}>Voir tous <ArrowRight size={14} /></button>
                    </div>
                    {docTable(sortedDocs.slice(0, 4), "Aucun document dans votre dossier pour le moment.")}
                  </section>
                </>
              )}

              {tab === "rdv" && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head">
                    <h2><CalendarDays size={22} /> Mes rendez-vous</h2>
                    <Link className="pd-btn pd-btn-primary pd-btn-sm" href="/rendez-vous">Prendre un rendez-vous</Link>
                  </div>
                  {apptTable(allAppts)}
                </section>
              )}

              {tab === "ordonnances" && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><Pill size={22} /> Mes ordonnances</h2></div>
                  {prescriptions.length === 0 && prescriptionDocs.length === 0 ? (
                    <div className="pd-empty">Vos ordonnances apparaîtront ici après vos consultations.</div>
                  ) : (
                    <>
                      {prescriptions.length > 0 && (
                        <div className="pd-scroll" style={{ marginBottom: prescriptionDocs.length ? 16 : 0 }}>
                          <table className="pd-table">
                            <thead><tr><th>Médicament</th><th>Posologie</th><th>Durée</th><th>Consignes</th><th>Prescrit le</th></tr></thead>
                            <tbody>
                              {prescriptions.map((r) => (
                                <tr key={r.id}>
                                  <td><div className="pd-docname"><span className="pd-ic green"><Pill size={17} /></span><span className="pd-strong">{r.medication_name}</span></div></td>
                                  <td>{r.dosage || "—"}</td>
                                  <td>{r.duration || "—"}</td>
                                  <td>{r.instructions || "—"}</td>
                                  <td className="pd-nowrap">{r._date ? fShort(r._date) : "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {prescriptionDocs.length > 0 && docTable(prescriptionDocs, "")}
                    </>
                  )}
                </section>
              )}

              {tab === "analyses" && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><FlaskConical size={22} /> Mes analyses</h2></div>
                  {docTable(docsIn("lab"), "Aucun résultat d'analyse dans votre dossier.")}
                </section>
              )}

              {tab === "documents" && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><FileText size={22} /> Mes documents</h2></div>
                  <div className="pd-toolbar">
                    <div className="pd-chips">
                      <button className={`pd-chip ${group === "all" ? "on" : ""}`} onClick={() => setGroup("all")}>Tous <em>{total}</em></button>
                      {counts.map((c) => (
                        <button key={c.id} className={`pd-chip ${group === c.id ? "on" : ""}`} onClick={() => setGroup(c.id)}>{c.label} <em>{c.n}</em></button>
                      ))}
                    </div>
                    <div className="pd-search">
                      <Search size={16} />
                      <input placeholder="Rechercher un document…" value={docQuery} onChange={(e) => setDocQuery(e.target.value)} />
                    </div>
                  </div>
                  {docTable(filteredDocs, q ? "Aucun document ne correspond à cette recherche." : "Aucun document dans cette catégorie.")}
                </section>
              )}

              {tab === "factures" && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><Receipt size={22} /> Mes factures</h2></div>
                  {invoices.length === 0 ? (
                    <div className="pd-empty">Aucune facture pour le moment.</div>
                  ) : (
                    <div className="pd-scroll">
                      <table className="pd-table">
                        <thead><tr><th>Prestation</th><th>Date</th><th>Médecin</th><th>Montant</th><th>Reste à payer</th><th>Statut</th></tr></thead>
                        <tbody>
                          {[...invoices].sort((a, b) => t(b.issued_at) - t(a.issued_at)).map((i) => {
                            const s = INV[i.status] ?? INV.unpaid;
                            return (
                              <tr key={i.id}>
                                <td className="pd-strong">{i.description}</td>
                                <td className="pd-nowrap">{i.issued_at ? fShort(i.issued_at) : "—"}</td>
                                <td>{i.doctor_id ? doctorName(i.doctor_id) : "—"}</td>
                                <td className="pd-strong pd-nowrap">{money(i.amount_due)}</td>
                                <td className="pd-nowrap">{money(i.balance_due ?? 0)}</td>
                                <td>{pill(s.label, s.tone)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <div className="pd-note"><Info size={16} /> Le règlement se fait auprès du secrétariat de votre cabinet.</div>
                </section>
              )}

              {tab === "historique" && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><History size={22} /> Historique</h2></div>
                  {events.length === 0 ? (
                    <div className="pd-empty">Rien pour le moment dans votre dossier.</div>
                  ) : (
                    <ul className="pd-tl">
                      {events.map((e) => (
                        <li key={e.k}>
                          <span className={`pd-ic ${e.tone}`}><e.icon size={16} /></span>
                          <div style={{ flexGrow: 1, minWidth: 0 }}>
                            <div className="pd-strong">{e.title}</div>
                            <div className="pd-sub">{e.sub}</div>
                          </div>
                          <span className="pd-sub pd-nowrap">{fShort(e.at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}
            </div>

            <div className="pd-col">
              <section className="pd-card pd-sec">
                <div className="pd-sec-head">
                  <h2><User size={22} fill="currentColor" /> Mes informations</h2>
                  <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={openEdit}><Pencil size={14} /> Modifier</button>
                </div>
                <dl className="pd-info">
                  {info.map(([k, v, Icon]) => (
                    <Fragment key={k}>
                      <div className="pd-info-row">
                        <span className="pd-info-ic"><Icon size={18} /></span>
                        <div><dt>{k}</dt><dd>{v}</dd></div>
                      </div>
                    </Fragment>
                  ))}
                </dl>
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><User size={22} /> Mes documents par catégorie</h2></div>
                <div className="pd-donut-wrap">
                  <div className="pd-donut" style={{ background: `conic-gradient(${donut})` }}>
                    <div className="pd-donut-hole"><b>{total}</b><span>au total</span></div>
                  </div>
                  <ul className="pd-legend">
                    {counts.map((c) => (
                      <li key={c.id}>
                        <i style={{ background: c.color }} />
                        <button onClick={() => { setGroup(c.id); setTab("documents"); }}>{c.label}</button>
                        <b>{c.n}</b>
                      </li>
                    ))}
                  </ul>
                </div>
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

      {editOpen && (
        <div className="pd-overlay" onClick={() => setEditOpen(false)}>
          <form className="pd-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="pd-modal-head">
              <h3>Modifier mes informations</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={() => setEditOpen(false)}><X size={16} /></button>
            </div>
            <div className="pd-form">
              <label>Prénom<input value={edit.first_name} onChange={(e) => setEdit((f) => ({ ...f, first_name: e.target.value }))} /></label>
              <label>Nom<input value={edit.last_name} onChange={(e) => setEdit((f) => ({ ...f, last_name: e.target.value }))} /></label>
              <label>CIN<input value={edit.national_id} onChange={(e) => setEdit((f) => ({ ...f, national_id: e.target.value }))} /></label>
              <label>Sexe
                <select value={edit.sex} onChange={(e) => setEdit((f) => ({ ...f, sex: e.target.value }))}>
                  <option value="F">Femme</option><option value="M">Homme</option>
                </select>
              </label>
              <label>Groupe sanguin
                <select value={edit.blood_group} onChange={(e) => setEdit((f) => ({ ...f, blood_group: e.target.value }))}>
                  {BLOOD.map((b) => <option key={b} value={b}>{b === "unknown" ? "Non renseigné" : b}</option>)}
                </select>
              </label>
              <label className="pd-full">Adresse<input value={edit.address} onChange={(e) => setEdit((f) => ({ ...f, address: e.target.value }))} /></label>
            </div>
            <p className="pd-hint">Pour modifier votre date de naissance, votre téléphone ou votre email, adressez-vous au secrétariat.</p>
            {editError && <p className="pd-err">{editError}</p>}
            <div className="pd-modal-actions">
              <button type="button" className="pd-btn pd-btn-ghost" onClick={() => setEditOpen(false)}>Annuler</button>
              <button type="submit" className="pd-btn pd-btn-primary" disabled={editSaving}>{editSaving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}

      {viewDoc && <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}

    </PatientShell>
  );
}
