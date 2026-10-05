"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, Eye, Download, Users, ScanLine, FlaskConical, Pill } from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal } from "@/components/PatientShell";
import DocumentViewer from "@/components/DocumentViewer";

type Group = "all" | "prescription" | "lab" | "report" | "imaging" | "other";

const DOC_LABELS: Record<string, string> = {
  prescription: "Ordonnance", lab_result: "Analyse", xray: "Radiographie", mri: "IRM", ct_scan: "Scanner",
  ultrasound: "Échographie", operative_report: "Compte-rendu", consultation_note: "Compte-rendu", other: "Autre",
};
const GROUP_OF: Record<string, Exclude<Group, "all">> = {
  prescription: "prescription", lab_result: "lab", operative_report: "report", consultation_note: "report",
  xray: "imaging", mri: "imaging", ct_scan: "imaging", ultrasound: "imaging", other: "other",
};
const GROUPS: { id: Exclude<Group, "all">; label: string; tone: string; icon: typeof FileText }[] = [
  { id: "prescription", label: "Ordonnances", tone: "green", icon: Pill },
  { id: "lab", label: "Analyses", tone: "violet", icon: FlaskConical },
  { id: "report", label: "Comptes-rendus", tone: "blue", icon: FileText },
  { id: "imaging", label: "Imagerie", tone: "orange", icon: ScanLine },
  { id: "other", label: "Autres", tone: "grey", icon: FileText },
];
const groupOf = (c: string) => GROUP_OF[c] ?? "other";

const t = (iso: string) => parseLocal(String(iso)).getTime();
const fDate = (iso: string) => parseLocal(String(iso)).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export default function DoctorDocumentsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [viewDoc, setViewDoc] = useState<any>(null);

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
          (pats ?? []).map((p: any) => api<any[]>(`/documents/patient/${p.id}`).then((l) => (l ?? []).map((d) => ({ ...d, _patient_id: p.id }))).catch(() => []))
        );
        setDocs(lists.flat());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger les documents.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const patientName = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Patient";
  };
  const patientInitials = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${(p.first_name ?? "?")[0]}${(p.last_name ?? "")[0] ?? ""}`.toUpperCase() : "?";
  };

  async function downloadDoc(docId: string) {
    try {
      const { url } = await api<{ url: string }>(`/documents/${docId}/view`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Téléchargement impossible.");
    }
  }

  const sorted = [...docs].sort((a, b) => t(b.document_date ?? b.created_at) - t(a.document_date ?? a.created_at));
  const thisWeek = sorted.filter((d) => t(d.document_date ?? d.created_at) >= weekAgo);
  const distinctPatients = new Set(docs.map((d) => d._patient_id)).size;
  const counts = GROUPS.map((g) => ({ ...g, n: sorted.filter((d) => groupOf(d.category) === g.id).length }));

  const q = query.trim().toLowerCase();
  const inGroup = group === "all" ? sorted : sorted.filter((d) => groupOf(d.category) === group);
  const shown = inGroup.filter((d) => !q || `${patientName(d._patient_id)} ${d.title}`.toLowerCase().includes(q));

  return (
    <PatientShell
      active="/doctor/documents"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin généraliste"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me?.first_name}
      lastName={me?.last_name}
      onSearch={(s) => { setQuery(s); setGroup("all"); }}
      searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
    >
      <div className="pd dd">
        <div className="dd-hello-row">
          <div>
            <h1 className="pd-name pd-hello">Documents</h1>
            <p className="pd-sub" style={{ fontSize: 14 }}>Analyses, imagerie et comptes-rendus de tous vos patients.</p>
          </div>
        </div>

        <div className="dd-stats dd-stats-3" style={{ marginBottom: 18 }}>
          <div className="dd-stat">
            <span className="dd-stat-ic blue"><FileText size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Total documents</span><b>{docs.length}</b><em>tous patients</em></span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-ic orange"><FlaskConical size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Cette semaine</span><b>{thisWeek.length}</b><em>documents ajoutés</em></span>
          </div>
          <div className="dd-stat">
            <span className="dd-stat-ic green"><Users size={20} /></span>
            <span className="dd-stat-body"><span className="dd-stat-k">Patients concernés</span><b>{distinctPatients}</b><em>patients distincts</em></span>
          </div>
        </div>

        <section className="pd-card pd-sec">
          <div className="pd-sec-head"><h2><FileText size={20} /> Tous les documents</h2></div>
          <div className="pd-toolbar">
            <div className="pd-chips">
              <button className={`pd-chip ${group === "all" ? "on" : ""}`} onClick={() => setGroup("all")}>Tous <em>{sorted.length}</em></button>
              {counts.map((c) => (
                <button key={c.id} className={`pd-chip ${group === c.id ? "on" : ""}`} onClick={() => setGroup(c.id)}>{c.label} <em>{c.n}</em></button>
              ))}
            </div>
            <div className="pd-search">
              <Search size={16} />
              <input placeholder="Patient ou document" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>
          {shown.length === 0 ? (
            <div className="pd-empty">{docs.length === 0 ? "Aucun document pour le moment. Le secrétariat ajoute les scans et analyses depuis son espace." : "Aucun document ne correspond."}</div>
          ) : (
            <div className="pd-scroll">
              <table className="pd-table">
                <thead><tr><th>Document</th><th>Patient</th><th>Type</th><th>Date</th><th className="pd-right">Actions</th></tr></thead>
                <tbody>
                  {shown.map((d) => {
                    const g = GROUPS.find((x) => x.id === groupOf(d.category))!;
                    return (
                      <tr key={d.id}>
                        <td><div className="pd-docname"><span className={`pd-ic ${g.tone}`}><g.icon size={16} /></span><span className="pd-strong">{d.title}</span></div></td>
                        <td>
                          <div className="pd-docname">
                            <span className="pd-docavatar">{patientInitials(d._patient_id)}</span>
                            <span>{patientName(d._patient_id)}</span>
                          </div>
                        </td>
                        <td><span className={`pd-pill ${g.tone}`}>{DOC_LABELS[d.category] ?? d.category}</span></td>
                        <td className="pd-nowrap">{fDate(d.document_date ?? d.created_at)}</td>
                        <td>
                          <div className="pd-actions">
                            <button className="pd-icon-btn" title="Voir" aria-label="Voir" onClick={() => setViewDoc(d)}><Eye size={15} /></button>
                            <button className="pd-icon-btn" title="Télécharger" aria-label="Télécharger" onClick={() => downloadDoc(d.id)}><Download size={15} /></button>
                          </div>
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

      {viewDoc && <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </PatientShell>
  );
}
