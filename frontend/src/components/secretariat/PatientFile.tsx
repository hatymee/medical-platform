"use client";

import { Fragment, useState } from "react";
import {
  ArrowLeft, ArrowRight, Plus, Pencil, EllipsisVertical, Phone, Mail, MapPin, User, Calendar,
  CalendarDays, Clock, FileText, Pill, FlaskConical, ScanLine, Receipt, History, LayoutGrid,
  Stethoscope, Eye, Download, Upload, Info, ShieldCheck, Archive, Search, CreditCard, Droplet,
  UserX, UserPlus, FolderOpen, ChevronRight, X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api/v1";

export interface PFPatient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string | null;
  blood_group: string;
  national_id: string | null;
  address: string | null;
  status: string;
  status_reason: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface PFAppointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
}

interface Props {
  patient: PFPatient;
  appointments: PFAppointment[];
  invoices: any[];
  docs: any[];
  doctorName: (id: string) => string;
  onBack: () => void;
  onNewAppointment: () => void;
  onViewAppointment: (a: PFAppointment) => void;
  onArchive: () => void;
  onRemove: () => void;
  onViewDoc: (doc: any) => void;
  onDownloadDoc: (docId: string) => void;
  onDocsChanged: () => void | Promise<void>;
  onPatientUpdated: () => void | Promise<void>;
}

type Tab = "overview" | "consultations" | "prescriptions" | "analyses" | "documents" | "invoices" | "history";
type DocGroup = "all" | "prescription" | "lab" | "report" | "imaging" | "other";
type Icon = typeof FileText;

const DOC_LABELS: Record<string, string> = {
  prescription: "Ordonnance",
  lab_result: "Analyse",
  xray: "Radiographie",
  mri: "IRM",
  ct_scan: "Scanner",
  ultrasound: "Échographie",
  operative_report: "Compte rendu opératoire",
  consultation_note: "Note de consultation",
  other: "Autre",
};

const GROUP_OF: Record<string, DocGroup> = {
  prescription: "prescription",
  lab_result: "lab",
  operative_report: "report",
  consultation_note: "report",
  xray: "imaging",
  mri: "imaging",
  ct_scan: "imaging",
  ultrasound: "imaging",
  other: "other",
};

const GROUPS: { id: DocGroup; label: string; icon: Icon; tone: string }[] = [
  { id: "all", label: "Tous les documents", icon: FileText, tone: "blue" },
  { id: "prescription", label: "Ordonnances", icon: Pill, tone: "green" },
  { id: "lab", label: "Analyses médicales", icon: FlaskConical, tone: "violet" },
  { id: "report", label: "Comptes-rendus", icon: FileText, tone: "blue" },
  { id: "imaging", label: "Imagerie (radios, scanner…)", icon: ScanLine, tone: "orange" },
  { id: "other", label: "Autres documents", icon: FileText, tone: "grey" },
];

const APT_STATUS: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Programmé", tone: "blue" },
  confirmed: { label: "Confirmé", tone: "green" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "grey" },
  no_show: { label: "Absence", tone: "red" },
};

const INV_STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: "Payée", tone: "green" },
  partial: { label: "Partielle", tone: "amber" },
  unpaid: { label: "Impayée", tone: "red" },
  cancelled: { label: "Annulée", tone: "grey" },
};

const BLOOD_GROUPS = ["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const ACCEPTED = ["application/pdf", "image/jpeg", "image/png", "image/heic"];
const MAX_BYTES = 10 * 1024 * 1024;

function parseLocal(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso ?? "");
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
}
const fmtLong = (iso: string) =>
  parseLocal(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
const fmtShort = (iso: string) =>
  parseLocal(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  parseLocal(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const toISODate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const money = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(Number(v ?? 0));

function ageOf(dob: string) {
  if (!dob) return null;
  const d = parseLocal(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function fileSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

const groupOf = (category: string): DocGroup => GROUP_OF[category] ?? "other";
const groupMeta = (g: DocGroup) => GROUPS.find((x) => x.id === g) ?? GROUPS[0];
const invoiceNumber = (i: any) => {
  const year = i.issued_at ? parseLocal(i.issued_at).getFullYear() : new Date().getFullYear();
  return `#${year}-${String(i.id ?? "").replace(/-/g, "").slice(0, 4).toUpperCase()}`;
};

export default function PatientFile({
  patient, appointments, invoices, docs, doctorName,
  onBack, onNewAppointment, onViewAppointment, onArchive, onRemove,
  onViewDoc, onDownloadDoc, onDocsChanged, onPatientUpdated,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [group, setGroup] = useState<DocGroup>("all");
  const [docQuery, setDocQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [docDate, setDocDate] = useState(toISODate(new Date()));
  const [dragging, setDragging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const [editOpen, setEditOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [edit, setEdit] = useState({
    first_name: "", last_name: "", national_id: "", date_of_birth: "", sex: "F", blood_group: "unknown", address: "",
  });

  const now = Date.now();
  const today = toISODate(new Date());
  const time = (iso: string) => parseLocal(iso).getTime();

  const pAppts = appointments
    .filter((a) => a.patient_id === patient.id)
    .sort((a, b) => time(b.scheduled_at) - time(a.scheduled_at));
  const upcoming = [...pAppts].reverse().find((a) => time(a.scheduled_at) >= now && a.status !== "cancelled") ?? null;
  const lastVisit = pAppts.find((a) => time(a.scheduled_at) < now && a.status !== "cancelled") ?? null;
  const consultations = pAppts.filter((a) => a.status === "completed");
  const lastConsult = consultations[0] ?? null;

  const pInvoices = invoices
    .filter((i) => i.patient_id === patient.id)
    .sort((a, b) => time(b.issued_at) - time(a.issued_at));
  const paidCount = pInvoices.filter((i) => i.status === "paid").length;
  const unpaidCount = pInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled").length;

  const sortedDocs = [...docs].sort((a, b) => time(b.document_date) - time(a.document_date));
  const docsIn = (g: DocGroup) => sortedDocs.filter((d) => g === "all" || groupOf(d.category) === g);
  const q = docQuery.trim().toLowerCase();
  const filteredDocs = docsIn(group).filter(
    (d) => !q || `${d.title} ${DOC_LABELS[d.category] ?? ""}`.toLowerCase().includes(q)
  );

  const isActive = (patient.status ?? "active") === "active";
  const statusPill = isActive
    ? { label: "Patient actif", tone: "green" }
    : patient.status === "removed"
    ? { label: "Retiré du cabinet", tone: "red" }
    : { label: "Archivé", tone: "grey" };
  const age = ageOf(patient.date_of_birth);
  const sexLabel = patient.sex === "M" ? "Homme" : patient.sex === "F" ? "Femme" : "Non renseigné";
  const bloodLabel = !patient.blood_group || patient.blood_group === "unknown" ? "Non renseigné" : patient.blood_group;

  const TABS: { id: Tab; label: string; icon: Icon }[] = [
    { id: "overview", label: "Vue générale", icon: LayoutGrid },
    { id: "consultations", label: "Consultations", icon: Stethoscope },
    { id: "prescriptions", label: "Ordonnances", icon: Pill },
    { id: "analyses", label: "Analyses", icon: FlaskConical },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "invoices", label: "Factures", icon: Receipt },
    { id: "history", label: "Historique", icon: History },
  ];

  const infoRows: [string, string, Icon][] = [
    ["Nom complet", `${patient.first_name} ${patient.last_name}`, User],
    ["CIN", patient.national_id || "Non renseigné", CreditCard],
    ["Date de naissance", patient.date_of_birth ? `${fmtLong(patient.date_of_birth)}${age !== null ? ` (${age} ans)` : ""}` : "Non renseignée", Calendar],
    ["Sexe", sexLabel, User],
    ["Groupe sanguin", bloodLabel, Droplet],
    ["Adresse", patient.address || "Non renseignée", MapPin],
    ["Téléphone", patient.phone || "Non renseigné", Phone],
    ["Email", patient.email || "Non renseigné", Mail],
  ];

  const events = [
    ...pAppts.map((a) => ({
      key: `a-${a.id}`, at: a.scheduled_at, icon: CalendarDays, tone: "blue",
      title: `Rendez-vous ${APT_STATUS[a.status]?.label.toLowerCase() ?? a.status}`,
      sub: `${a.reason || "Sans motif"}, ${doctorName(a.doctor_id)}`,
    })),
    ...docs.map((d) => ({
      key: `d-${d.id}`, at: d.document_date, icon: FileText, tone: groupMeta(groupOf(d.category)).tone,
      title: `Document ajouté : ${DOC_LABELS[d.category] ?? d.category}`,
      sub: d.title,
    })),
    ...pInvoices.map((i) => ({
      key: `i-${i.id}`, at: i.issued_at, icon: Receipt, tone: INV_STATUS[i.status]?.tone ?? "red",
      title: `Facture ${invoiceNumber(i)} de ${money(i.amount_due)}`,
      sub: `${i.description}, ${(INV_STATUS[i.status] ?? INV_STATUS.unpaid).label.toLowerCase()}`,
    })),
  ]
    .filter((e) => e.at)
    .sort((a, b) => time(b.at) - time(a.at));

  function openEdit() {
    setEdit({
      first_name: patient.first_name ?? "",
      last_name: patient.last_name ?? "",
      national_id: patient.national_id ?? "",
      date_of_birth: (patient.date_of_birth ?? "").slice(0, 10),
      sex: patient.sex ?? "F",
      blood_group: patient.blood_group || "unknown",
      address: patient.address ?? "",
    });
    setEditError("");
    setMenuOpen(false);
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
      const res = await fetch(`${API_URL}/patients/${patient.id}/administrative`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("medical_token") ?? ""}`,
        },
        body: JSON.stringify({
          first_name: edit.first_name.trim(),
          last_name: edit.last_name.trim(),
          national_id: edit.national_id.trim() || null,
          date_of_birth: edit.date_of_birth || undefined,
          sex: edit.sex,
          blood_group: edit.blood_group,
          address: edit.address.trim() || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const detail = typeof data.detail === "string" ? data.detail : "Enregistrement impossible.";
        throw new Error(detail);
      }
      await onPatientUpdated();
      setEditOpen(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setEditSaving(false);
    }
  }

  function pickFile(f: File) {
    setError("");
    if (!ACCEPTED.includes(f.type)) {
      setError("Format non accepté. Utilisez un PDF, JPG, PNG ou HEIC.");
      return;
    }
    if (f.size > MAX_BYTES) {
      setError("Fichier trop lourd : 10 Mo maximum.");
      return;
    }
    setFile(f);
    if (!title.trim()) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  async function upload() {
    setError("");
    if (!file || !category || !title.trim() || !docDate) {
      setError("Ajoutez un fichier, puis choisissez le type, le titre et la date.");
      return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.append("patient_id", patient.id);
      body.append("category", category);
      body.append("title", title.trim());
      body.append("document_date", docDate);
      body.append("file", file);
      const res = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("medical_token") ?? ""}` },
        body,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(typeof data.detail === "string" ? data.detail : "Envoi impossible.");
      }
      setFile(null);
      setTitle("");
      setCategory("");
      setDocDate(toISODate(new Date()));
      setInputKey((k) => k + 1);
      await onDocsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible.");
    } finally {
      setSaving(false);
    }
  }

  const pill = (label: string, tone: string) => <span className={`pf-pill ${tone}`}>{label}</span>;

  const apptTable = (list: PFAppointment[], empty: string) =>
    list.length === 0 ? (
      <div className="pf-empty">{empty}</div>
    ) : (
      <div className="pf-scroll">
        <table className="pf-table">
          <thead>
            <tr><th>Date &amp; Heure</th><th>Motif</th><th>Médecin</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const s = APT_STATUS[a.status] ?? { label: a.status, tone: "grey" };
              return (
                <tr key={a.id}>
                  <td className="pf-nowrap">{fmtShort(a.scheduled_at)} - {fmtTime(a.scheduled_at)}</td>
                  <td>{a.reason || "Consultation"}</td>
                  <td>{doctorName(a.doctor_id)}</td>
                  <td>{pill(s.label, s.tone)}</td>
                  <td><button className="pf-btn pf-btn-ghost pf-btn-xs" onClick={() => onViewAppointment(a)}>Voir</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const docTable = (list: any[], empty: string) =>
    list.length === 0 ? (
      <div className="pf-empty">{empty}</div>
    ) : (
      <div className="pf-scroll">
        <table className="pf-table">
          <thead>
            <tr><th>Nom du document</th><th>Type</th><th>Date d&apos;ajout</th><th className="pf-right">Actions</th></tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const g = groupMeta(groupOf(d.category));
              const GIcon = g.icon;
              const extra = [d.file_name, fileSize(d.file_size)].filter(Boolean).join(", ");
              return (
                <tr key={d.id}>
                  <td>
                    <div className="pf-docname">
                      <span className={`pf-ic ${g.tone}`}><GIcon size={18} /></span>
                      <div style={{ minWidth: 0 }}>
                        <div className="pf-strong pf-ellipsis">{d.title}</div>
                        {extra && <div className="pf-sub">{extra}</div>}
                      </div>
                    </div>
                  </td>
                  <td>{pill(DOC_LABELS[d.category] ?? d.category, g.tone)}</td>
                  <td>
                    <div>{fmtShort(d.document_date)}</div>
                    {d.uploaded_by_name && <div className="pf-sub">{d.uploaded_by_name}</div>}
                  </td>
                  <td>
                    <div className="pf-row-actions">
                      <button className="pf-icon-btn" title="Voir" aria-label="Voir" onClick={() => onViewDoc(d)}>
                        <Eye size={16} />
                      </button>
                      <button className="pf-icon-btn" title="Télécharger" aria-label="Télécharger" onClick={() => onDownloadDoc(d.id)}>
                        <Download size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const invoiceTable = (list: any[]) =>
    list.length === 0 ? (
      <div className="pf-empty">Aucune facture pour ce patient.</div>
    ) : (
      <div className="pf-scroll">
        <table className="pf-table">
          <thead>
            <tr><th>Facture</th><th>Prestation</th><th>Date</th><th>Montant</th><th>Reste</th><th>Statut</th></tr>
          </thead>
          <tbody>
            {list.map((i) => {
              const s = INV_STATUS[i.status] ?? INV_STATUS.unpaid;
              return (
                <tr key={i.id}>
                  <td className="pf-strong pf-nowrap">{invoiceNumber(i)}</td>
                  <td>{i.description}</td>
                  <td className="pf-nowrap">{i.issued_at ? fmtShort(i.issued_at) : "—"}</td>
                  <td className="pf-nowrap">{money(i.amount_due)}</td>
                  <td className={Number(i.balance_due) > 0 ? "pf-amber pf-nowrap" : "pf-muted pf-nowrap"}>{money(i.balance_due ?? 0)}</td>
                  <td>{pill(s.label, s.tone)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );

  const summaryCard = (
    <section className="pf-card pf-sec">
      <div className="pf-sec-head">
        <h3 className="pf-sec-title"><FileText size={20} /> Résumé du patient</h3>
        <button className="pf-chev" aria-label="Vue générale" onClick={() => setTab("overview")}><ChevronRight size={18} /></button>
      </div>
      {[
        { icon: FileText, k: "Dernier RDV", v: lastVisit ? `${fmtShort(lastVisit.scheduled_at)} - ${lastVisit.reason || "Consultation"}` : "Aucun" },
        { icon: CalendarDays, k: "Prochaine visite", v: upcoming ? `${fmtShort(upcoming.scheduled_at)} - ${fmtTime(upcoming.scheduled_at)}` : "Aucune de prévue" },
        { icon: Calendar, k: "Nombre de rendez-vous", v: String(pAppts.length) },
      ].map((r) => (
        <div key={r.k} className="pf-sum-row">
          <span className="pf-ic blue"><r.icon size={17} /></span>
          <div><div className="pf-sum-k">{r.k}</div><div className="pf-sum-v">{r.v}</div></div>
        </div>
      ))}
      <div className="pf-sum-row">
        <span className="pf-ic blue"><Receipt size={17} /></span>
        <div>
          <div className="pf-sum-k">Factures</div>
          <div className="pf-sum-v">
            {pInvoices.length} ({paidCount} payée{paidCount > 1 ? "s" : ""}){" "}
            {unpaidCount > 0 && pill(`${unpaidCount} impayée${unpaidCount > 1 ? "s" : ""}`, "red")}
          </div>
        </div>
      </div>
    </section>
  );

  const uploadCard = (
    <section className="pf-card pf-sec">
      <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><FileText size={20} /> Ajouter un document</h3>
      <label
        className={`pf-drop ${dragging ? "on" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) pickFile(f);
        }}
      >
        <input
          key={inputKey}
          type="file"
          hidden
          accept={ACCEPTED.join(",")}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
        />
        <Upload size={28} />
        {file ? (
          <span className="pf-file">{file.name}</span>
        ) : (
          <span>Glissez-déposez un fichier ici<br />ou cliquez pour parcourir</span>
        )}
        <small>PDF, JPG, PNG (max 10 Mo)</small>
      </label>

      <h4 className="pf-subtitle">Informations du document</h4>
      <div className="pf-form">
        <div>
          <label className="pf-lab">Type de document *</label>
          <select className="pf-field" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Sélectionner le type</option>
            {Object.entries(DOC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="pf-lab">Date d&apos;ajout *</label>
          <input className="pf-field" type="date" max={today} value={docDate} onChange={(e) => setDocDate(e.target.value)} />
        </div>
        <div>
          <label className="pf-lab">Titre *</label>
          <input className="pf-field" placeholder="Ex. : Analyse sanguine" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
      </div>

      {error && <p className="pf-err">{error}</p>}

      <button className="pf-btn pf-btn-primary pf-btn-block" disabled={saving} onClick={upload}>
        <Upload size={16} /> {saving ? "Envoi en cours…" : "Téléverser le document"}
      </button>
    </section>
  );

  return (
    <div className="pf">
      <button className="pf-back" onClick={onBack}><ArrowLeft size={16} /> Retour à la liste</button>

      <section className="pf-card">
        <div className="pf-head">
          <div className="pf-avatar"><User size={64} fill="currentColor" strokeWidth={1} /></div>
          <div className="pf-id">
            <h2 className="pf-name">
              {patient.first_name} {patient.last_name}
              {pill(statusPill.label, statusPill.tone)}
            </h2>
            <div className="pf-meta">
              <span>CIN : <b>{patient.national_id || "non renseigné"}</b></span>
              {patient.date_of_birth && (
                <>
                  <i className="pf-dot" />
                  <span>Né(e) le : <b>{fmtLong(patient.date_of_birth)}</b></span>
                </>
              )}
              {age !== null && (<><i className="pf-dot" /><b>{age} ans</b></>)}
              <i className="pf-dot" />
              <b>{sexLabel}</b>
            </div>
            <div className="pf-meta pf-contact">
              <span><Phone size={16} /> {patient.phone || "Téléphone non renseigné"}</span>
              <span><Mail size={16} /> {patient.email || "Email non renseigné"}</span>
            </div>
            <div className="pf-meta pf-contact">
              <span><MapPin size={16} /> {patient.address || "Adresse non renseignée"}</span>
            </div>
            {!isActive && patient.status_reason && (
              <div className="pf-meta"><span><Info size={15} /> Motif : {patient.status_reason}</span></div>
            )}
          </div>
          <div className="pf-actions">
            <button className="pf-btn pf-btn-primary" onClick={onNewAppointment}><Plus size={17} /> Nouveau rendez-vous</button>
            <button className="pf-btn pf-btn-ghost" onClick={openEdit}><Pencil size={16} /> Modifier</button>
            <div className="pf-menu-wrap">
              <button className="pf-btn pf-btn-ghost pf-btn-icon" aria-label="Plus d'actions" onClick={() => setMenuOpen((v) => !v)}>
                <EllipsisVertical size={18} />
              </button>
              {menuOpen && (
                <>
                  <div className="pf-menu-backdrop" onClick={() => setMenuOpen(false)} />
                  <div className="pf-menu" role="menu">
                    <button role="menuitem" onClick={() => { setMenuOpen(false); setTab("documents"); }}>
                      <Upload size={16} /> Ajouter un document
                    </button>
                    {isActive && (
                      <>
                        <button role="menuitem" onClick={() => { setMenuOpen(false); onArchive(); }}>
                          <Archive size={16} /> Archiver le dossier
                        </button>
                        <button role="menuitem" className="danger" onClick={() => { setMenuOpen(false); onRemove(); }}>
                          <UserX size={16} /> Retirer du cabinet
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <nav className="pf-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`pf-tab ${tab === t.id ? "on" : ""}`}
              onClick={() => setTab(t.id)}
            >
              <t.icon size={18} />
              {t.label}
            </button>
          ))}
        </nav>
      </section>

      {tab === "overview" && (
        <div className="pf-grid">
          <div className="pf-col">
            <section className="pf-card pf-sec">
              <div className="pf-sec-head">
                <h3 className="pf-sec-title"><User size={20} fill="currentColor" /> Informations personnelles</h3>
                <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={openEdit}><Pencil size={15} /> Modifier</button>
              </div>
              <dl className="pf-info">
                {infoRows.map(([label, value, RowIcon]) => (
                  <Fragment key={label}>
                    <dt><RowIcon size={15} /> {label}</dt>
                    <dd>{value}</dd>
                  </Fragment>
                ))}
              </dl>
            </section>

            <section className="pf-card pf-sec">
              <div className="pf-sec-head">
                <h3 className="pf-sec-title"><CalendarDays size={20} /> Historique des rendez-vous</h3>
                <button className="pf-link" onClick={() => setTab("history")}>Voir tous</button>
              </div>
              {apptTable(pAppts.slice(0, 5), "Aucun rendez-vous pour ce patient.")}
            </section>

            <section className="pf-card pf-sec">
              <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><UserPlus size={20} /> Préinscriptions</h3>
              <div className="pf-note pf-note-row">
                <Info size={18} />
                <span>Aucune préinscription trouvée pour ce patient.</span>
                <button className="pf-btn pf-btn-primary pf-btn-sm pf-note-r" onClick={onNewAppointment}>
                  Créer une préinscription
                </button>
              </div>
            </section>
          </div>

          <div className="pf-col">
            <section className="pf-card pf-sec">
              <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><CalendarDays size={20} /> Prochain rendez-vous</h3>
              {upcoming ? (
                <div className="pf-next">
                  <div className="pf-date">
                    <b>{parseLocal(upcoming.scheduled_at).getDate()}</b>
                    <span>{parseLocal(upcoming.scheduled_at).toLocaleDateString("fr-FR", { month: "short" })}</span>
                  </div>
                  <div className="pf-next-time"><Clock size={14} /> {fmtTime(upcoming.scheduled_at)}</div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="pf-strong">{upcoming.reason || "Consultation générale"}</div>
                    <div className="pf-sub">{doctorName(upcoming.doctor_id)}</div>
                  </div>
                  {pill(APT_STATUS[upcoming.status]?.label ?? upcoming.status, APT_STATUS[upcoming.status]?.tone ?? "grey")}
                </div>
              ) : (
                <div className="pf-empty pf-empty-sm">
                  Aucun rendez-vous prévu.
                  <button className="pf-link" onClick={onNewAppointment}>Planifier un rendez-vous</button>
                </div>
              )}
              <button className="pf-link pf-link-arrow" onClick={() => setTab("history")}>
                Voir tous les rendez-vous <ArrowRight size={14} />
              </button>
            </section>

            <section className="pf-card pf-sec">
              <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><FileText size={20} /> Dernière consultation</h3>
              {lastConsult ? (
                <div className="pf-last">
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="pf-strong">{fmtShort(lastConsult.scheduled_at)}</div>
                    <div className="pf-strong pf-soft">{lastConsult.reason || "Consultation générale"}</div>
                    <div className="pf-sub">{doctorName(lastConsult.doctor_id)}</div>
                  </div>
                  <button className="pf-btn pf-btn-ghost pf-btn-sm" onClick={() => onViewAppointment(lastConsult)}>Voir le détail</button>
                  <ChevronRight size={18} className="pf-muted" />
                </div>
              ) : (
                <div className="pf-empty pf-empty-sm">Aucune consultation terminée.</div>
              )}
            </section>

            <section className="pf-card pf-sec">
              <div className="pf-sec-head">
                <h3 className="pf-sec-title"><FolderOpen size={20} fill="currentColor" /> Documents médicaux</h3>
                <button className="pf-link" onClick={() => setTab("documents")}>Voir tout</button>
              </div>
              {sortedDocs.length === 0 ? (
                <div className="pf-empty pf-empty-sm">Aucun document.</div>
              ) : (
                sortedDocs.slice(0, 3).map((d) => (
                  <div key={d.id} className="pf-mini">
                    <span className="pf-ic pdf"><FileText size={18} /></span>
                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                      <div className="pf-strong pf-ellipsis">{d.title}</div>
                      <div className="pf-sub">{fmtShort(d.document_date)}</div>
                    </div>
                    <button className="pf-icon-btn pf-icon-plain" title="Télécharger" aria-label="Télécharger" onClick={() => onDownloadDoc(d.id)}>
                      <Download size={18} />
                    </button>
                  </div>
                ))
              )}
            </section>

            <section className="pf-card pf-sec">
              <div className="pf-sec-head">
                <h3 className="pf-sec-title"><Receipt size={20} /> Factures</h3>
                <button className="pf-link" onClick={() => setTab("invoices")}>Voir tout</button>
              </div>
              {pInvoices.length === 0 ? (
                <div className="pf-empty pf-empty-sm">Aucune facture.</div>
              ) : (
                pInvoices.slice(0, 3).map((i) => {
                  const s = INV_STATUS[i.status] ?? INV_STATUS.unpaid;
                  return (
                    <div key={i.id} className="pf-mini">
                      <span className="pf-ic blue"><FileText size={17} /></span>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div className="pf-strong">Facture {invoiceNumber(i)}</div>
                        <div className="pf-strong">{money(i.amount_due)}</div>
                        <div className="pf-sub">{i.issued_at ? fmtShort(i.issued_at) : ""}</div>
                      </div>
                      {pill(s.label, s.tone)}
                      <button className="pf-chev" aria-label="Voir les factures" onClick={() => setTab("invoices")}><ChevronRight size={18} /></button>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        </div>
      )}

      {tab === "consultations" && (
        <section className="pf-card pf-sec pf-gap">
          <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><Stethoscope size={20} /> Consultations</h3>
          {apptTable(consultations, "Aucune consultation terminée pour ce patient.")}
        </section>
      )}

      {tab === "prescriptions" && (
        <section className="pf-card pf-sec pf-gap">
          <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><Pill size={20} /> Ordonnances</h3>
          {docTable(docsIn("prescription"), "Aucune ordonnance dans ce dossier.")}
        </section>
      )}

      {tab === "analyses" && (
        <section className="pf-card pf-sec pf-gap">
          <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><FlaskConical size={20} /> Analyses</h3>
          {docTable(docsIn("lab"), "Aucune analyse dans ce dossier.")}
        </section>
      )}

      {tab === "documents" && (
        <div className="pf-grid">
          <section className="pf-card pf-sec">
            <div className="pf-sec-head" style={{ alignItems: "flex-start" }}>
              <div className="pf-doc-head">
                <span className="pf-ic blue pf-ic-lg"><FileText size={24} /></span>
                <div>
                  <h3 className="pf-sec-title">Documents médicaux</h3>
                  <p className="pf-sub" style={{ margin: "4px 0 0" }}>Gérez et consultez tous les documents liés au dossier médical de ce patient.</p>
                </div>
              </div>
            </div>

            <div className="pf-docs">
              <div className="pf-groups">
                {GROUPS.map((g) => (
                  <button key={g.id} className={`pf-group ${group === g.id ? "on" : ""}`} onClick={() => setGroup(g.id)}>
                    <span className={`pf-ic ${group === g.id ? "blue" : "soft"} pf-ic-sm`}><g.icon size={15} /></span>
                    <span>{g.label}</span>
                    <em>{docsIn(g.id).length}</em>
                  </button>
                ))}
              </div>
              <div className="pf-docs-main">
                <div className="pf-toolbar">
                  <h4 className="pf-toolbar-title">{groupMeta(group).label} ({filteredDocs.length})</h4>
                  <div className="pf-search">
                    <Search size={16} />
                    <input
                      className="pf-field"
                      placeholder="Rechercher un document…"
                      value={docQuery}
                      onChange={(e) => setDocQuery(e.target.value)}
                    />
                  </div>
                </div>
                {docTable(filteredDocs, q ? "Aucun document ne correspond à cette recherche." : "Aucun document dans cette catégorie.")}
              </div>
            </div>

            <div className="pf-note">
              <Info size={16} />
              <span>Ces documents sont accessibles uniquement aux professionnels de santé autorisés et au patient.</span>
              <span className="pf-note-r"><ShieldCheck size={16} /> Dossier médical sécurisé</span>
            </div>
          </section>

          <div className="pf-col">
            {summaryCard}
            {uploadCard}
          </div>
        </div>
      )}

      {tab === "invoices" && (
        <section className="pf-card pf-sec pf-gap">
          <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><Receipt size={20} /> Factures</h3>
          {invoiceTable(pInvoices)}
        </section>
      )}

      {tab === "history" && (
        <section className="pf-card pf-sec pf-gap">
          <h3 className="pf-sec-title" style={{ marginBottom: 14 }}><History size={20} /> Historique</h3>
          {events.length === 0 ? (
            <div className="pf-empty">Rien pour le moment dans ce dossier.</div>
          ) : (
            <ul className="pf-tl">
              {events.map((e) => (
                <li key={e.key}>
                  <span className={`pf-ic ${e.tone}`}><e.icon size={16} /></span>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div className="pf-strong">{e.title}</div>
                    <div className="pf-sub">{e.sub}</div>
                  </div>
                  <span className="pf-sub pf-nowrap">{fmtShort(e.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editOpen && (
        <div className="pf-overlay" onClick={() => setEditOpen(false)}>
          <form className="pf-modal" onClick={(e) => e.stopPropagation()} onSubmit={saveEdit}>
            <div className="pf-modal-head">
              <h3>Modifier les informations</h3>
              <button type="button" className="pf-chev" aria-label="Fermer" onClick={() => setEditOpen(false)}><X size={18} /></button>
            </div>
            <div className="pf-modal-grid">
              <div><label className="pf-lab">Prénom</label><input className="pf-field" value={edit.first_name} onChange={(e) => setEdit((f) => ({ ...f, first_name: e.target.value }))} /></div>
              <div><label className="pf-lab">Nom</label><input className="pf-field" value={edit.last_name} onChange={(e) => setEdit((f) => ({ ...f, last_name: e.target.value }))} /></div>
              <div><label className="pf-lab">CIN</label><input className="pf-field" value={edit.national_id} onChange={(e) => setEdit((f) => ({ ...f, national_id: e.target.value }))} /></div>
              <div><label className="pf-lab">Date de naissance</label><input className="pf-field" type="date" max={today} value={edit.date_of_birth} onChange={(e) => setEdit((f) => ({ ...f, date_of_birth: e.target.value }))} /></div>
              <div>
                <label className="pf-lab">Sexe</label>
                <select className="pf-field" value={edit.sex} onChange={(e) => setEdit((f) => ({ ...f, sex: e.target.value }))}>
                  <option value="F">Femme</option>
                  <option value="M">Homme</option>
                </select>
              </div>
              <div>
                <label className="pf-lab">Groupe sanguin</label>
                <select className="pf-field" value={edit.blood_group} onChange={(e) => setEdit((f) => ({ ...f, blood_group: e.target.value }))}>
                  {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b === "unknown" ? "Non renseigné" : b}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className="pf-lab">Adresse</label>
                <input className="pf-field" value={edit.address} onChange={(e) => setEdit((f) => ({ ...f, address: e.target.value }))} />
              </div>
            </div>
            {editError && <p className="pf-err">{editError}</p>}
            <div className="pf-modal-actions">
              <button type="button" className="pf-btn pf-btn-ghost" onClick={() => setEditOpen(false)}>Annuler</button>
              <button type="submit" className="pf-btn pf-btn-primary" disabled={editSaving}>
                {editSaving ? "Enregistrement…" : "Enregistrer les modifications"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        .pf {
          --blue: #1877e0; --blue-dark: #0f5cbf; --blue-soft: #eaf3fd;
          --navy: #0a2540; --muted: #5a7590; --line: #e1eaf3;
          --green: #1a7f4b; --green-bg: #e3f5ea;
          --amber: #a86a12; --amber-bg: #fbf0de;
          --red: #cf3a3a; --red-bg: #fcebeb;
          --violet: #6b4fd8; --violet-bg: #efebfd;
          --orange: #d9731a; --orange-bg: #fdf0e3;
          --grey: #5a7590; --grey-bg: #eef2f6;
          color: var(--navy);
        }
        .pf-back {
          display: inline-flex; align-items: center; gap: 8px; margin: 0 0 16px; padding: 0;
          background: none; border: none; color: var(--blue); font: inherit; font-size: 14px; font-weight: 500; cursor: pointer;
        }
        .pf-back:hover { text-decoration: underline; }
        .pf-card { background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: 0 1px 2px rgba(10, 37, 64, 0.04); }
        .pf-sec { padding: 20px 22px; }
        .pf-gap { margin-top: 18px; }

        .pf-head { display: flex; gap: 24px; align-items: flex-start; padding: 22px 24px 18px; }
        .pf-avatar {
          width: 96px; height: 96px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: flex-end; justify-content: center; overflow: hidden;
          background: var(--blue-soft); color: var(--blue); padding-bottom: 6px; box-sizing: border-box;
        }
        .pf-id { flex-grow: 1; min-width: 0; }
        .pf-name {
          display: flex; align-items: center; flex-wrap: wrap; gap: 12px;
          margin: 2px 0 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.02em;
        }
        .pf-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-bottom: 10px; font-size: 14px; color: var(--muted); }
        .pf-meta span { display: inline-flex; align-items: center; gap: 8px; }
        .pf-meta b { color: var(--navy); font-weight: 500; }
        .pf-contact { color: var(--navy); gap: 6px 32px; }
        .pf-contact svg { color: var(--blue); }
        .pf-dot { width: 4px; height: 4px; border-radius: 50%; background: #9db4cc; display: inline-block; }
        .pf-actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

        .pf-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 18px; border: 1px solid transparent; border-radius: 9px;
          font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .pf-btn:focus-visible, .pf-tab:focus-visible, .pf-group:focus-visible, .pf-icon-btn:focus-visible,
        .pf-back:focus-visible, .pf-link:focus-visible, .pf-chev:focus-visible, .pf-menu button:focus-visible {
          outline: 3px solid rgba(24, 119, 224, 0.35); outline-offset: 2px;
        }
        .pf-btn-primary { background: var(--blue); color: #fff; box-shadow: 0 4px 12px rgba(24, 119, 224, 0.25); }
        .pf-btn-primary:hover { background: var(--blue-dark); }
        .pf-btn-primary:disabled { opacity: 0.55; cursor: default; }
        .pf-btn-ghost { background: #fff; color: var(--navy); border-color: var(--line); }
        .pf-btn-ghost svg { color: var(--blue); }
        .pf-btn-ghost:hover { border-color: var(--blue); color: var(--blue); }
        .pf-btn-sm { padding: 7px 14px; font-size: 13px; }
        .pf-btn-xs { padding: 5px 14px; font-size: 13px; font-weight: 500; color: var(--blue); }
        .pf-btn-icon { padding: 10px; }
        .pf-btn-block { width: 100%; margin-top: 18px; padding: 13px 16px; }

        .pf-menu-wrap { position: relative; }
        .pf-menu-backdrop { position: fixed; inset: 0; z-index: 60; }
        .pf-menu {
          position: absolute; right: 0; top: calc(100% + 6px); z-index: 61; min-width: 220px; padding: 6px;
          background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 16px 40px rgba(10, 37, 64, 0.16);
        }
        .pf-menu button {
          display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border: none; border-radius: 8px;
          background: none; font: inherit; font-size: 14px; color: var(--navy); text-align: left; cursor: pointer;
        }
        .pf-menu button svg { color: var(--blue); }
        .pf-menu button:hover { background: var(--blue-soft); }
        .pf-menu button.danger, .pf-menu button.danger svg { color: var(--red); }
        .pf-menu button.danger:hover { background: var(--red-bg); }

        .pf-tabs { display: flex; gap: 6px; padding: 0 16px; border-top: 1px solid var(--line); background: #fbfdff; border-radius: 0 0 14px 14px; overflow-x: auto; }
        .pf-tab {
          display: inline-flex; align-items: center; gap: 9px; padding: 16px 14px 13px;
          background: none; border: none; border-bottom: 3px solid transparent;
          font: inherit; font-size: 14px; font-weight: 500; color: var(--muted); cursor: pointer; white-space: nowrap;
        }
        .pf-tab:hover { color: var(--navy); }
        .pf-tab.on { color: var(--blue); border-bottom-color: var(--blue); font-weight: 600; }

        .pf-grid { display: grid; grid-template-columns: minmax(0, 1fr) 420px; gap: 18px; margin-top: 18px; align-items: start; }
        .pf-col { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
        .pf-sec-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .pf-sec-title { display: flex; align-items: center; gap: 12px; margin: 0; font-size: 16px; font-weight: 700; }
        .pf-sec-title svg { color: var(--blue); flex-shrink: 0; }
        .pf-subtitle { margin: 20px 0 0; font-size: 14px; font-weight: 700; }
        .pf-link { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; padding: 0; font: inherit; font-size: 13px; font-weight: 500; color: var(--blue); cursor: pointer; }
        .pf-link:hover { text-decoration: underline; }
        .pf-link-arrow { margin-top: 14px; }
        .pf-chev { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border: none; border-radius: 8px; background: none; color: var(--navy); cursor: pointer; }
        .pf-chev:hover { background: var(--blue-soft); color: var(--blue); }

        .pf-info {
          display: grid; grid-template-columns: minmax(150px, 190px) 1fr; row-gap: 14px; column-gap: 16px;
          margin: 0; padding: 18px 20px; border: 1px solid var(--line); border-radius: 12px; font-size: 14px;
        }
        .pf-info dt { display: flex; align-items: center; gap: 12px; color: var(--muted); }
        .pf-info dt svg { color: #7d97b2; }
        .pf-info dd { margin: 0; font-weight: 500; min-width: 0; overflow-wrap: anywhere; }

        .pf-scroll { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
        .pf-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .pf-table th {
          text-align: left; padding: 12px 14px; font-size: 13px; font-weight: 500; color: var(--muted);
          background: #f7fafd; border-bottom: 1px solid var(--line); white-space: nowrap;
        }
        .pf-table td { padding: 12px 14px; border-bottom: 1px solid var(--line); vertical-align: middle; }
        .pf-table tr:last-child td { border-bottom: none; }
        .pf-table tbody tr:hover td { background: #fafcfe; }
        .pf-right { text-align: right !important; }
        .pf-nowrap { white-space: nowrap; }
        .pf-row-actions { display: flex; justify-content: flex-end; gap: 6px; }
        .pf-docname { display: flex; align-items: center; gap: 12px; min-width: 0; }

        .pf-strong { font-weight: 600; }
        .pf-soft { font-weight: 500; margin-top: 2px; }
        .pf-muted { color: var(--muted); }
        .pf-amber { color: var(--amber); font-weight: 600; }
        .pf-sub { display: flex; align-items: center; gap: 5px; font-size: 13px; color: var(--muted); margin-top: 3px; }
        .pf-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .pf-pill { display: inline-block; padding: 3px 11px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
        .pf-pill.blue, .pf-ic.blue { background: var(--blue-soft); color: var(--blue-dark); }
        .pf-pill.green, .pf-ic.green { background: var(--green-bg); color: var(--green); }
        .pf-pill.amber, .pf-ic.amber { background: var(--amber-bg); color: var(--amber); }
        .pf-pill.red, .pf-ic.red, .pf-ic.pdf { background: var(--red-bg); color: var(--red); }
        .pf-pill.violet, .pf-ic.violet { background: var(--violet-bg); color: var(--violet); }
        .pf-pill.orange, .pf-ic.orange { background: var(--orange-bg); color: var(--orange); }
        .pf-pill.grey, .pf-ic.grey { background: var(--grey-bg); color: var(--grey); }
        .pf-ic.soft { background: #f3f7fb; color: var(--blue); }
        .pf-ic { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .pf-ic-sm { width: 30px; height: 30px; border-radius: 8px; }
        .pf-ic-lg { width: 48px; height: 48px; border-radius: 50%; }

        .pf-icon-btn {
          width: 34px; height: 34px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid var(--line); border-radius: 9px; background: #fff; color: var(--blue); cursor: pointer;
        }
        .pf-icon-btn:hover { background: var(--blue-soft); border-color: var(--blue); }
        .pf-icon-plain { border-color: transparent; }

        .pf-empty { padding: 28px 20px; text-align: center; font-size: 14px; color: var(--muted); border: 1px dashed var(--line); border-radius: 12px; }
        .pf-empty-sm { padding: 16px; display: flex; flex-direction: column; align-items: center; gap: 8px; }

        .pf-next { display: flex; align-items: center; gap: 10px; padding: 12px; font-size: 13px; border: 1px solid var(--line); border-radius: 12px; }
        .pf-date { min-width: 44px; padding: 6px 10px 6px 0; border-right: 1px solid var(--line); text-align: center; }
        .pf-date b { display: block; font-size: 22px; font-weight: 800; line-height: 1.1; }
        .pf-date span { font-size: 12px; color: var(--muted); }
        .pf-next-time { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; white-space: nowrap; }
        .pf-next-time svg { color: var(--muted); }
        .pf-last { display: flex; align-items: center; gap: 10px; }
        .pf-mini .pf-strong { font-weight: 500; font-size: 13px; }
        .pf-mini { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid var(--line); }
        .pf-mini:first-of-type { border-top: none; padding-top: 0; }

        .pf-doc-head { display: flex; align-items: center; gap: 14px; }
        .pf-docs { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 16px; }
        .pf-groups { display: flex; flex-direction: column; gap: 4px; }
        .pf-group {
          display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1px solid transparent; border-radius: 10px;
          background: none; font: inherit; font-size: 13px; color: var(--navy); text-align: left; cursor: pointer;
        }
        .pf-group:hover { background: #f5f9fd; }
        .pf-group.on { background: var(--blue-soft); border-color: #d5e6f8; color: var(--blue-dark); font-weight: 600; }
        .pf-group em { margin-left: auto; font-style: normal; font-size: 13px; color: var(--muted); }
        .pf-docs-main { min-width: 0; border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
        .pf-docs-main .pf-scroll { border: none; }
        .pf-toolbar { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .pf-toolbar-title { margin: 0; font-size: 15px; font-weight: 700; white-space: nowrap; }

        .pf-search { position: relative; flex: 1; }
        .pf-search svg { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
        .pf-search .pf-field { padding-left: 40px; }
        .pf-field {
          width: 100%; box-sizing: border-box; padding: 10px 14px; font: inherit; font-size: 14px;
          color: var(--navy); background: #fff; border: 1px solid var(--line); border-radius: 9px;
        }
        .pf-field:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 4px rgba(24, 119, 224, 0.14); }
        .pf-lab { display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500; color: var(--muted); }
        .pf-form { display: grid; gap: 14px; margin-top: 12px; }
        .pf-err { margin: 14px 0 0; font-size: 14px; font-weight: 600; color: var(--red); }

        .pf-drop {
          display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 16px;
          border: 2px dashed #b9d3ef; border-radius: 12px; background: #f7fbff;
          text-align: center; font-size: 14px; line-height: 1.5; color: var(--blue); cursor: pointer;
        }
        .pf-drop:hover, .pf-drop.on { border-color: var(--blue); background: var(--blue-soft); }
        .pf-drop small { font-size: 12px; color: var(--muted); }
        .pf-file { font-weight: 700; color: var(--navy); overflow-wrap: anywhere; }

        .pf-sum-row { display: flex; align-items: flex-start; gap: 12px; padding: 11px 0; }
        .pf-sum-k { font-size: 12px; color: var(--muted); }
        .pf-sum-v { font-size: 14px; font-weight: 500; margin-top: 2px; }

        .pf-note {
          display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 18px; padding: 12px 16px;
          border-radius: 10px; background: var(--blue-soft); color: var(--blue-dark); font-size: 13px; border: 1px solid #d5e6f8;
        }
        .pf-note-row { margin-top: 0; }
        .pf-note-r { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }

        .pf-tl { list-style: none; margin: 0; padding: 0; }
        .pf-tl li { display: flex; align-items: center; gap: 14px; padding: 12px 0; border-top: 1px solid var(--line); }
        .pf-tl li:first-child { border-top: none; padding-top: 0; }

        .pf-overlay {
          position: fixed; inset: 0; z-index: 1000; padding: 24px; background: rgba(10, 37, 64, 0.42);
          display: flex; align-items: center; justify-content: center;
        }
        .pf-modal {
          width: 560px; max-width: 100%; max-height: 90vh; overflow-y: auto; box-sizing: border-box;
          padding: 24px; background: #fff; border-radius: 16px; box-shadow: 0 30px 70px rgba(10, 37, 64, 0.28);
        }
        .pf-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
        .pf-modal-head h3 { margin: 0; font-size: 19px; font-weight: 800; }
        .pf-modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .pf-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

        @media (max-width: 1350px) {
          .pf-grid { grid-template-columns: minmax(0, 1fr) 360px; }
          .pf-docs { grid-template-columns: 1fr; }
          .pf-groups { flex-direction: row; flex-wrap: wrap; }
          .pf-group em { margin-left: 6px; }
        }
        @media (max-width: 1100px) {
          .pf-grid { grid-template-columns: 1fr; }
          .pf-head { flex-wrap: wrap; }
          .pf-actions { width: 100%; }
        }
        @media (max-width: 640px) {
          .pf-info, .pf-modal-grid { grid-template-columns: 1fr; }
          .pf-info { row-gap: 4px; }
          .pf-info dd { margin-bottom: 10px; }
          .pf-avatar { width: 72px; height: 72px; }
          .pf-name { font-size: 21px; }
          .pf-toolbar { flex-wrap: wrap; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pf * { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
