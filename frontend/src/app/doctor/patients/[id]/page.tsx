"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, User, CreditCard, Phone, Mail, MapPin, Droplet, CalendarDays, Clock, Stethoscope, Pill,
  FileText, Receipt, LayoutGrid, Eye, Download, X, ChevronRight, ClipboardList, Wallet,
} from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal, clock } from "@/components/PatientShell";
import DocumentViewer from "@/components/DocumentViewer";

type Consultation = { id: string; patient_id: string; doctor_id: string; consultation_date: string; reason: string | null; notes: string | null };
type Prescription = { id: string; consultation_id: string; medication_name: string; dosage: string | null; duration: string | null; instructions: string | null };
type Tab = "overview" | "consultations" | "ordonnances" | "documents" | "factures" | "rdv";

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
  unpaid: { label: "Impayée", tone: "red" },
  cancelled: { label: "Annulée", tone: "grey" },
};
const DOC_LABELS: Record<string, string> = {
  prescription: "Ordonnance", lab_result: "Analyse", xray: "Radiographie", mri: "IRM", ct_scan: "Scanner",
  ultrasound: "Échographie", operative_report: "Compte-rendu", consultation_note: "Compte-rendu", other: "Autre",
};
const DOC_TONE: Record<string, string> = {
  prescription: "green", lab_result: "violet", xray: "orange", mri: "orange", ct_scan: "orange", ultrasound: "orange",
  operative_report: "blue", consultation_note: "blue", other: "grey",
};

const t = (iso: string) => parseLocal(String(iso)).getTime();
const longDay = (iso: string) => parseLocal(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const fShort = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const money = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(Number(v ?? 0));

function ageOf(dob?: string | null) {
  if (!dob) return null;
  const d = parseLocal(dob);
  const n = new Date();
  let a = n.getFullYear() - d.getFullYear();
  const m = n.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--;
  return a;
}

export default function DoctorPatientRecordPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = String(params?.id ?? "");

  const [me, setMe] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = useState<Record<string, Prescription[]>>({});
  const [appointments, setAppointments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const [consultOpen, setConsultOpen] = useState(false);
  const [consultForm, setConsultForm] = useState({ reason: "", notes: "" });
  const [rxTarget, setRxTarget] = useState<Consultation | null>(null);
  const [rxForm, setRxForm] = useState({ medication_name: "", dosage: "", duration: "", instructions: "" });
  const [billTarget, setBillTarget] = useState<Consultation | null>(null);
  const [billForm, setBillForm] = useState({ procedureId: "", description: "", amount_due: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [viewDoc, setViewDoc] = useState<any>(null);

  const loadClinical = useCallback(async () => {
    const list = (await api<Consultation[]>(`/consultations/patient/${patientId}`).catch(() => [])) ?? [];
    setConsultations([...list].sort((a, b) => t(b.consultation_date) - t(a.consultation_date)));
    const entries = await Promise.all(
      list.map(async (c) => [c.id, (await api<Prescription[]>(`/consultations/${c.id}/prescriptions`).catch(() => [])) ?? []] as const)
    );
    setPrescriptions(Object.fromEntries(entries));
  }, [patientId]);

  const loadBilling = useCallback(async () => {
    setInvoices((await api<any[]>(`/billing/invoices/patient/${patientId}`).catch(() => [])) ?? []);
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const [profile, all, apts, documents, procs] = await Promise.all([
          api<any>("/doctors/me").catch(() => null),
          api<any[]>("/patients/?status=all").catch(() => []),
          api<any[]>("/appointments/mine").catch(() => []),
          api<any[]>(`/documents/patient/${patientId}`).catch(() => []),
          api<any[]>("/procedures").catch(() => []),
        ]);
        setMe(profile);
        setPatient((all ?? []).find((p) => p.id === patientId) ?? null);
        setAppointments((apts ?? []).filter((a) => a.patient_id === patientId));
        setDocs(documents ?? []);
        setProcedures((procs ?? []).filter((p: any) => p.is_active !== false));
        await Promise.all([loadClinical(), loadBilling()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger ce dossier.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, loadClinical, loadBilling, router]);

  async function submitConsultation(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!consultForm.reason.trim()) {
      setFormError("Le motif est requis.");
      return;
    }
    setSaving(true);
    try {
      await api("/consultations", {
        method: "POST",
        body: JSON.stringify({ patient_id: patientId, reason: consultForm.reason.trim(), notes: consultForm.notes.trim() || null }),
      });
      setConsultOpen(false);
      setConsultForm({ reason: "", notes: "" });
      await loadClinical();
      setTab("consultations");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function submitPrescription(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!rxTarget || !rxForm.medication_name.trim()) {
      setFormError("Le nom du médicament est requis.");
      return;
    }
    setSaving(true);
    try {
      await api(`/consultations/${rxTarget.id}/prescriptions`, {
        method: "POST",
        body: JSON.stringify({
          medication_name: rxForm.medication_name.trim(),
          dosage: rxForm.dosage.trim() || null,
          duration: rxForm.duration.trim() || null,
          instructions: rxForm.instructions.trim() || null,
        }),
      });
      setRxTarget(null);
      setRxForm({ medication_name: "", dosage: "", duration: "", instructions: "" });
      await loadClinical();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const amount = parseFloat(billForm.amount_due.replace(",", "."));
    if (!billForm.description.trim() || !amount || amount <= 0) {
      setFormError("Une description et un montant positif sont requis.");
      return;
    }
    setSaving(true);
    try {
      await api("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          consultation_id: billTarget?.id ?? null,
          doctor_id: me?.id ?? null,
          description: billForm.description.trim(),
          amount_due: amount,
        }),
      });
      setBillTarget(null);
      setBillForm({ procedureId: "", description: "", amount_due: "" });
      await loadBilling();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Facturation impossible.");
    } finally {
      setSaving(false);
    }
  }

  function openBill(c: Consultation) {
    setBillTarget(c);
    setBillForm({ procedureId: "", description: c.reason || "Consultation", amount_due: "" });
    setFormError("");
  }

  async function downloadDoc(docId: string) {
    try {
      const { url } = await api<{ url: string }>(`/documents/${docId}/view`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Téléchargement impossible.");
    }
  }

  const now = Date.now();
  const fullName = patient ? `${patient.first_name} ${patient.last_name}` : "Dossier patient";
  const age = ageOf(patient?.date_of_birth);
  const sexLabel = patient?.sex === "M" || patient?.sex === "male" ? "Homme" : patient?.sex === "F" || patient?.sex === "female" ? "Femme" : "Non renseigné";
  const blood = patient?.blood_group && patient.blood_group !== "unknown" ? patient.blood_group : "Non renseigné";
  const allRx = consultations.flatMap((c) => (prescriptions[c.id] ?? []).map((r) => ({ ...r, _c: c })));
  const sortedAppts = [...appointments].sort((a, b) => t(b.scheduled_at) - t(a.scheduled_at));
  const nextAppt = [...appointments].filter((a) => t(a.scheduled_at) >= now && a.status !== "cancelled").sort((a, b) => t(a.scheduled_at) - t(b.scheduled_at))[0];
  const lastConsult = consultations[0];
  const sortedDocs = [...docs].sort((a, b) => t(b.document_date ?? b.created_at) - t(a.document_date ?? a.created_at));
  const invoiced = invoices.reduce((s, i) => s + Number(i.amount_due ?? 0), 0);
  const unpaid = invoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const invoiceFor = (cid: string) => invoices.find((i) => i.consultation_id === cid);
  const pill = (label: string, tone: string) => <span className={`pd-pill ${tone}`}>{label}</span>;
  const initials = patient ? `${patient.first_name?.[0] ?? ""}${patient.last_name?.[0] ?? ""}`.toUpperCase() : "?";

  const TABS: { id: Tab; label: string; icon: typeof LayoutGrid; n?: number }[] = [
    { id: "overview", label: "Vue générale", icon: LayoutGrid },
    { id: "consultations", label: "Consultations", icon: Stethoscope, n: consultations.length },
    { id: "ordonnances", label: "Ordonnances", icon: Pill, n: allRx.length },
    { id: "documents", label: "Documents", icon: FileText, n: docs.length },
    { id: "factures", label: "Factures", icon: Receipt, n: invoices.length },
    { id: "rdv", label: "Rendez-vous", icon: CalendarDays, n: appointments.length },
  ];

  const consultCard = (c: Consultation) => {
    const rx = prescriptions[c.id] ?? [];
    const inv = invoiceFor(c.id);
    return (
      <div className="dp-consult" key={c.id}>
        <div className="dp-consult-top">
          <span className="pd-ic blue"><Stethoscope size={17} /></span>
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <div className="pd-strong">{c.reason || "Consultation"}</div>
            <div className="pd-sub" style={{ textTransform: "none" }}>{longDay(c.consultation_date)}</div>
          </div>
          {inv ? pill(`Facturée ${money(inv.amount_due)}`, (INV[inv.status] ?? INV.unpaid).tone) : pill("Non facturée", "grey")}
        </div>
        {c.notes && <p className="dp-notes">{c.notes}</p>}
        {rx.length > 0 && (
          <div className="dp-rx-list">
            {rx.map((r) => (
              <div className="dp-rx" key={r.id}>
                <Pill size={15} />
                <div>
                  <b>{r.medication_name}{r.dosage ? `, ${r.dosage}` : ""}</b>
                  {(r.duration || r.instructions) && <span>{[r.duration, r.instructions].filter(Boolean).join(", ")}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="dp-consult-actions">
          <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={() => { setRxTarget(c); setFormError(""); }}><Pill size={14} /> Ajouter une prescription</button>
          {!inv && <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={() => openBill(c)}><Wallet size={14} /> Facturer</button>}
        </div>
      </div>
    );
  };

  return (
    <>
      <PatientShell
        active="/doctor/patients"
        nav={DOCTOR_NAV}
        home="/doctor/dashboard"
        roleLabel="Médecin généraliste"
        status={error ? "error" : loading ? "loading" : "ready"}
        error={error}
        firstName={me?.first_name}
        lastName={me?.last_name}
        onSearch={() => router.push("/doctor/patients")}
        searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
        notifCount={unpaid.length}
      >
        <div className="pd dd">
          <Link className="pd-back" href="/doctor/patients"><ArrowLeft size={16} /> Retour à la liste des patients</Link>

          {!patient ? (
            <div className="pd-card pd-sec"><div className="pd-empty">Ce patient est introuvable ou n&apos;est plus rattaché au cabinet.</div></div>
          ) : (
            <div className="pd-grid">
              <div className="pd-col">
                <section className="pd-card pd-headcard">
                  <div className="pd-head">
                    <div className="pd-avatar dp-avatar">{initials}</div>
                    <div className="pd-id">
                      <h1 className="pd-name">{fullName} {pill((patient.status ?? "active") === "active" ? "Patient actif" : "Archivé", (patient.status ?? "active") === "active" ? "green" : "grey")}</h1>
                      <div className="pd-meta">
                        <span><CreditCard size={15} /> CIN : {patient.national_id || "non renseigné"}</span>
                        {patient.date_of_birth && (<><i className="pd-dot" /><span>Né(e) le {parseLocal(patient.date_of_birth).toLocaleDateString("fr-FR")}</span></>)}
                        {age !== null && (<><i className="pd-dot" /><span>{age} ans</span></>)}
                        <i className="pd-dot" /><span>{sexLabel}</span>
                        <i className="pd-dot" /><span><Droplet size={15} /> {blood}</span>
                      </div>
                      <div className="pd-meta pd-contact">
                        {patient.phone && <span><Phone size={16} /> {patient.phone}</span>}
                        {patient.email && <span><Mail size={16} /> {patient.email}</span>}
                        <span><MapPin size={16} /> {patient.address || "Adresse non renseignée"}</span>
                      </div>
                    </div>
                    <div className="dp-head-btns">
                      <button className="pd-btn pd-btn-primary" onClick={() => { setConsultOpen(true); setFormError(""); }}><Plus size={16} /> Nouvelle consultation</button>
                      {lastConsult && !invoiceFor(lastConsult.id) && (
                        <button className="pd-btn pd-btn-ghost" onClick={() => openBill(lastConsult)}><Wallet size={16} /> Facturer la dernière</button>
                      )}
                    </div>
                  </div>
                </section>

                <nav className="pd-card pd-tabs" role="tablist">
                  {TABS.map((x) => (
                    <button key={x.id} role="tab" aria-selected={tab === x.id} className={`pd-tab ${tab === x.id ? "on" : ""}`} onClick={() => setTab(x.id)}>
                      <x.icon size={18} /> {x.label}{x.n ? <em className="dp-count">{x.n}</em> : null}
                    </button>
                  ))}
                </nav>

                {tab === "overview" && (
                  <>
                    <div className="dd-stats">
                      <button className="dd-stat" onClick={() => setTab("consultations")}>
                        <span className="dd-stat-ic violet"><Stethoscope size={20} /></span>
                        <span className="dd-stat-body"><span className="dd-stat-k">Consultations</span><b>{consultations.length}</b><em>{lastConsult ? `dernière le ${fShort(lastConsult.consultation_date)}` : "aucune"}</em></span>
                      </button>
                      <button className="dd-stat" onClick={() => setTab("ordonnances")}>
                        <span className="dd-stat-ic orange"><Pill size={20} /></span>
                        <span className="dd-stat-body"><span className="dd-stat-k">Ordonnances</span><b>{allRx.length}</b><em>prescriptions</em></span>
                      </button>
                      <button className="dd-stat" onClick={() => setTab("rdv")}>
                        <span className="dd-stat-ic blue"><CalendarDays size={20} /></span>
                        <span className="dd-stat-body"><span className="dd-stat-k">Rendez-vous</span><b>{appointments.length}</b><em>{nextAppt ? `prochain le ${fShort(nextAppt.scheduled_at)}` : "aucun à venir"}</em></span>
                      </button>
                      <button className="dd-stat" onClick={() => setTab("factures")}>
                        <span className="dd-stat-ic green"><Receipt size={20} /></span>
                        <span className="dd-stat-body"><span className="dd-stat-k">Facturé</span><b>{money(invoiced)}</b><em className={unpaid.length ? "dd-warn" : ""}>{unpaid.length ? `${unpaid.length} impayée(s)` : "tout est réglé"}</em></span>
                      </button>
                    </div>

                    <section className="pd-card pd-sec">
                      <div className="pd-sec-head">
                        <h2><ClipboardList size={20} /> Dernière consultation</h2>
                        {consultations.length > 1 && <button className="pd-link" onClick={() => setTab("consultations")}>Voir l&apos;historique <ChevronRight size={14} /></button>}
                      </div>
                      {lastConsult ? consultCard(lastConsult) : (
                        <div className="pd-empty">
                          Aucune consultation enregistrée pour ce patient.
                          <div style={{ marginTop: 12 }}><button className="pd-btn pd-btn-primary pd-btn-sm" onClick={() => { setConsultOpen(true); setFormError(""); }}><Plus size={14} /> Créer la première consultation</button></div>
                        </div>
                      )}
                    </section>

                    <section className="pd-card pd-sec">
                      <div className="pd-sec-head">
                        <h2><FileText size={20} /> Documents récents</h2>
                        {docs.length > 0 && <button className="pd-link" onClick={() => setTab("documents")}>Voir tout <ChevronRight size={14} /></button>}
                      </div>
                      {sortedDocs.length === 0 ? (
                        <div className="pd-empty">Aucun document. Le secrétariat ajoute les scans et analyses depuis son espace.</div>
                      ) : sortedDocs.slice(0, 3).map((d) => (
                        <div className="pd-row" key={d.id}>
                          <span className={`pd-ic ${DOC_TONE[d.category] ?? "grey"}`}><FileText size={16} /></span>
                          <div style={{ flexGrow: 1, minWidth: 0 }}>
                            <div className="pd-strong pd-ellipsis">{d.title}</div>
                            <div className="pd-sub">{DOC_LABELS[d.category] ?? d.category}, {fShort(d.document_date ?? d.created_at)}</div>
                          </div>
                          <button className="pd-icon-btn" title="Voir" aria-label="Voir" onClick={() => setViewDoc(d)}><Eye size={15} /></button>
                        </div>
                      ))}
                    </section>
                  </>
                )}

                {tab === "consultations" && (
                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head">
                      <h2><Stethoscope size={20} /> Historique des consultations</h2>
                      <button className="pd-btn pd-btn-primary pd-btn-sm" onClick={() => { setConsultOpen(true); setFormError(""); }}><Plus size={14} /> Nouvelle consultation</button>
                    </div>
                    {consultations.length === 0 ? <div className="pd-empty">Aucune consultation enregistrée pour ce patient.</div> : (
                      <div className="dp-timeline">{consultations.map(consultCard)}</div>
                    )}
                  </section>
                )}

                {tab === "ordonnances" && (
                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head"><h2><Pill size={20} /> Ordonnances</h2></div>
                    {allRx.length === 0 ? <div className="pd-empty">Aucune prescription. Ajoutez-en depuis une consultation.</div> : (
                      <div className="pd-scroll">
                        <table className="pd-table">
                          <thead><tr><th>Médicament</th><th>Posologie</th><th>Durée</th><th>Instructions</th><th>Consultation</th></tr></thead>
                          <tbody>
                            {allRx.map((r) => (
                              <tr key={r.id}>
                                <td><div className="pd-docname"><span className="pd-ic orange"><Pill size={16} /></span><span className="pd-strong">{r.medication_name}</span></div></td>
                                <td>{r.dosage || "—"}</td>
                                <td>{r.duration || "—"}</td>
                                <td>{r.instructions || "—"}</td>
                                <td className="pd-nowrap">{fShort(r._c.consultation_date)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {tab === "documents" && (
                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head"><h2><FileText size={20} /> Documents médicaux</h2></div>
                    {sortedDocs.length === 0 ? <div className="pd-empty">Aucun document. Le secrétariat ajoute les scans et analyses depuis son espace.</div> : (
                      <div className="pd-scroll">
                        <table className="pd-table">
                          <thead><tr><th>Document</th><th>Type</th><th>Date</th><th className="pd-right">Actions</th></tr></thead>
                          <tbody>
                            {sortedDocs.map((d) => (
                              <tr key={d.id}>
                                <td><div className="pd-docname"><span className={`pd-ic ${DOC_TONE[d.category] ?? "grey"}`}><FileText size={16} /></span><span className="pd-strong">{d.title}</span></div></td>
                                <td>{pill(DOC_LABELS[d.category] ?? d.category, DOC_TONE[d.category] ?? "grey")}</td>
                                <td className="pd-nowrap">{fShort(d.document_date ?? d.created_at)}</td>
                                <td><div className="pd-actions">
                                  <button className="pd-icon-btn" title="Voir" aria-label="Voir" onClick={() => setViewDoc(d)}><Eye size={15} /></button>
                                  <button className="pd-icon-btn" title="Télécharger" aria-label="Télécharger" onClick={() => downloadDoc(d.id)}><Download size={15} /></button>
                                </div></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}

                {tab === "factures" && (
                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head"><h2><Receipt size={20} /> Factures</h2></div>
                    {invoices.length === 0 ? <div className="pd-empty">Aucune facture pour ce patient. Utilisez « Facturer » sur une consultation.</div> : (
                      <div className="pd-scroll">
                        <table className="pd-table">
                          <thead><tr><th>Prestation</th><th>Date</th><th>Montant</th><th>Reste</th><th>Statut</th></tr></thead>
                          <tbody>
                            {[...invoices].sort((a, b) => t(b.issued_at) - t(a.issued_at)).map((i) => {
                              const s = INV[i.status] ?? INV.unpaid;
                              return (
                                <tr key={i.id}>
                                  <td className="pd-strong">{i.description}</td>
                                  <td className="pd-nowrap">{i.issued_at ? fShort(i.issued_at) : "—"}</td>
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
                    <p className="pd-hint">Les règlements sont enregistrés par le secrétariat à l&apos;accueil.</p>
                  </section>
                )}

                {tab === "rdv" && (
                  <section className="pd-card pd-sec">
                    <div className="pd-sec-head"><h2><CalendarDays size={20} /> Rendez-vous avec vous</h2></div>
                    {sortedAppts.length === 0 ? <div className="pd-empty">Aucun rendez-vous avec ce patient.</div> : (
                      <div className="pd-scroll">
                        <table className="pd-table">
                          <thead><tr><th>Date &amp; Heure</th><th>Motif</th><th>Statut</th></tr></thead>
                          <tbody>
                            {sortedAppts.map((a) => (
                              <tr key={a.id}>
                                <td className="pd-nowrap">{fShort(a.scheduled_at)} - {clock(String(a.scheduled_at))}</td>
                                <td>{a.reason || "Consultation"}</td>
                                <td>{pill(APT[a.status]?.label ?? a.status, APT[a.status]?.tone ?? "grey")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
              </div>

              <div className="pd-col">
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><User size={20} /> Informations médicales</h2></div>
                  <dl className="pd-info">
                    {([
                      ["Âge", age !== null ? `${age} ans` : "Non renseigné", User],
                      ["Sexe", sexLabel, User],
                      ["Groupe sanguin", blood, Droplet],
                      ["CIN", patient.national_id || "Non renseigné", CreditCard],
                      ["Téléphone", patient.phone || "Non renseigné", Phone],
                      ["Email", patient.email || "Non renseigné", Mail],
                    ] as [string, string, typeof User][]).map(([k, v, Icon]) => (
                      <div className="pd-info-row" key={k}>
                        <span className="pd-info-ic"><Icon size={18} /></span>
                        <div><dt>{k}</dt><dd>{v}</dd></div>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><Clock size={20} /> Prochain rendez-vous</h2></div>
                  {nextAppt ? (
                    <div className="pd-row">
                      <div className="pd-datebox pd-datebox-sm">
                        <b>{parseLocal(nextAppt.scheduled_at).getDate()}</b>
                        <span>{parseLocal(nextAppt.scheduled_at).toLocaleDateString("fr-FR", { month: "short" })}</span>
                      </div>
                      <div style={{ flexGrow: 1 }}>
                        <div className="pd-strong">{nextAppt.reason || "Consultation"}</div>
                        <div className="pd-sub">{clock(String(nextAppt.scheduled_at))}</div>
                      </div>
                      {pill(APT[nextAppt.status]?.label ?? nextAppt.status, APT[nextAppt.status]?.tone ?? "grey")}
                    </div>
                  ) : <div className="pd-empty">Aucun rendez-vous à venir.</div>}
                </section>
              </div>
            </div>
          )}
        </div>
      </PatientShell>

      {consultOpen && (
        <div className="pd-overlay" onClick={() => setConsultOpen(false)}>
          <form className="pd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitConsultation}>
            <div className="pd-modal-head">
              <h3>Nouvelle consultation</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={() => setConsultOpen(false)}><X size={16} /></button>
            </div>
            <p className="pd-sub" style={{ marginTop: -8, marginBottom: 16 }}>{fullName}</p>
            <div className="pd-form">
              <label className="pd-full">Motif<input autoFocus placeholder="Douleurs abdominales" value={consultForm.reason} onChange={(e) => setConsultForm((f) => ({ ...f, reason: e.target.value }))} /></label>
              <label className="pd-full">Observations<textarea rows={5} placeholder="Examen clinique, diagnostic, conduite à tenir…" value={consultForm.notes} onChange={(e) => setConsultForm((f) => ({ ...f, notes: e.target.value }))} /></label>
            </div>
            {formError && <p className="pd-err">{formError}</p>}
            <div className="pd-modal-actions">
              <button type="button" className="pd-btn pd-btn-ghost" onClick={() => setConsultOpen(false)}>Annuler</button>
              <button type="submit" className="pd-btn pd-btn-primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer la consultation"}</button>
            </div>
          </form>
        </div>
      )}

      {rxTarget && (
        <div className="pd-overlay" onClick={() => setRxTarget(null)}>
          <form className="pd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitPrescription}>
            <div className="pd-modal-head">
              <h3>Nouvelle prescription</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={() => setRxTarget(null)}><X size={16} /></button>
            </div>
            <p className="pd-sub" style={{ marginTop: -8, marginBottom: 16 }}>{rxTarget.reason || "Consultation"}, {longDay(rxTarget.consultation_date)}</p>
            <div className="pd-form">
              <label className="pd-full">Médicament<input autoFocus placeholder="Amoxicilline" value={rxForm.medication_name} onChange={(e) => setRxForm((f) => ({ ...f, medication_name: e.target.value }))} /></label>
              <label>Posologie<input placeholder="500 mg, 3 fois par jour" value={rxForm.dosage} onChange={(e) => setRxForm((f) => ({ ...f, dosage: e.target.value }))} /></label>
              <label>Durée<input placeholder="7 jours" value={rxForm.duration} onChange={(e) => setRxForm((f) => ({ ...f, duration: e.target.value }))} /></label>
              <label className="pd-full">Instructions<textarea rows={3} placeholder="À prendre pendant les repas" value={rxForm.instructions} onChange={(e) => setRxForm((f) => ({ ...f, instructions: e.target.value }))} /></label>
            </div>
            {formError && <p className="pd-err">{formError}</p>}
            <div className="pd-modal-actions">
              <button type="button" className="pd-btn pd-btn-ghost" onClick={() => setRxTarget(null)}>Annuler</button>
              <button type="submit" className="pd-btn pd-btn-primary" disabled={saving}>{saving ? "Enregistrement…" : "Prescrire"}</button>
            </div>
          </form>
        </div>
      )}

      {billTarget && (
        <div className="pd-overlay" onClick={() => setBillTarget(null)}>
          <form className="pd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitInvoice}>
            <div className="pd-modal-head">
              <h3>Facturer la consultation</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={() => setBillTarget(null)}><X size={16} /></button>
            </div>
            <p className="pd-sub" style={{ marginTop: -8, marginBottom: 16 }}>{fullName}, {longDay(billTarget.consultation_date)}</p>
            <div className="pd-form">
              {procedures.length > 0 && (
                <label className="pd-full">Acte
                  <select
                    value={billForm.procedureId}
                    onChange={(e) => {
                      const proc = procedures.find((p) => p.id === e.target.value);
                      setBillForm((f) => ({ ...f, procedureId: e.target.value, description: proc ? proc.label : f.description, amount_due: proc ? String(proc.price) : f.amount_due }));
                    }}
                  >
                    <option value="">Saisie libre</option>
                    {procedures.map((p) => <option key={p.id} value={p.id}>{p.label}, {money(p.price)}</option>)}
                  </select>
                </label>
              )}
              <label className="pd-full">Description<input value={billForm.description} onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value, procedureId: "" }))} /></label>
              <label className="pd-full">Montant (MAD)<input inputMode="decimal" placeholder="300" value={billForm.amount_due} onChange={(e) => setBillForm((f) => ({ ...f, amount_due: e.target.value }))} /></label>
            </div>
            <p className="pd-hint">Le règlement sera enregistré par le secrétariat à l&apos;accueil.</p>
            {formError && <p className="pd-err">{formError}</p>}
            <div className="pd-modal-actions">
              <button type="button" className="pd-btn pd-btn-ghost" onClick={() => setBillTarget(null)}>Annuler</button>
              <button type="submit" className="pd-btn pd-btn-primary" disabled={saving}>{saving ? "Enregistrement…" : "Créer la facture"}</button>
            </div>
          </form>
        </div>
      )}

      {viewDoc && <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </>
  );
}
