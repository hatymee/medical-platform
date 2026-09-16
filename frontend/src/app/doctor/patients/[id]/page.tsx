"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal, clock } from "@/components/PatientShell";

type Consultation = {
  id: string;
  patient_id: string;
  doctor_id: string;
  consultation_date: string;
  reason: string | null;
  notes: string | null;
};

type Prescription = {
  id: string;
  consultation_id: string;
  medication_name: string;
  dosage: string | null;
  duration: string | null;
  instructions: string | null;
};

const longDay = (iso: string) =>
  parseLocal(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function DoctorPatientRecordPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = String(params?.id ?? "");

  const [me, setMe] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [prescriptions, setPrescriptions] = useState<Record<string, Prescription[]>>({});
  const [appointments, setAppointments] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [consultOpen, setConsultOpen] = useState(false);
  const [consultForm, setConsultForm] = useState({ reason: "", notes: "" });
  const [rxTarget, setRxTarget] = useState<Consultation | null>(null);
  const [rxForm, setRxForm] = useState({ medication_name: "", dosage: "", duration: "", instructions: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);  
  const [invoices, setInvoices] = useState<any[]>([]);
  const [billTarget, setBillTarget] = useState<Consultation | null>(null);
  const [billForm, setBillForm] = useState({ description: "", amount_due: "" });

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
          description: billForm.description.trim(),
          amount_due: amount,
        }),
      });
      setBillTarget(null);
      setBillForm({ description: "", amount_due: "" });
      await load();
      setInvoices((await api<any[]>(`/billing/invoices/patient/${patientId}`).catch(() => [])) ?? []);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Facturation impossible.");
    } finally {
      setSaving(false);
    }
  }


  const load = useCallback(async () => {
    const list = (await api<Consultation[]>(`/consultations/patient/${patientId}`).catch(() => [])) ?? [];
    setConsultations(
      [...list].sort(
        (a, b) => parseLocal(b.consultation_date).getTime() - parseLocal(a.consultation_date).getTime()
      )
    );
    const entries = await Promise.all(
      list.map(async (c) => [c.id, (await api<Prescription[]>(`/consultations/${c.id}/prescriptions`).catch(() => [])) ?? []] as const)
    );
    setPrescriptions(Object.fromEntries(entries));
  }, [patientId]);

  useEffect(() => {
    if (!patientId) return;
    (async () => {
      try {
        const [profile, all, apts] = await Promise.all([
          api<any>("/doctors/me").catch(() => null),
          api<any[]>("/patients/?status=all").catch(() => []),
          api<any[]>("/appointments/mine").catch(() => []),
        ]);
        setMe(profile);
        setPatient((all ?? []).find((p) => p.id === patientId) ?? null);
        setAppointments((apts ?? []).filter((a) => a.patient_id === patientId));
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger ce dossier.");
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, load]);

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
        body: JSON.stringify({
          patient_id: patientId,
          reason: consultForm.reason.trim(),
          notes: consultForm.notes.trim() || null,
        }),
      });
      setConsultOpen(false);
      setConsultForm({ reason: "", notes: "" });
      await load();
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
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  const fullName = patient ? `${patient.first_name} ${patient.last_name}` : "Dossier patient";
  const rxCount = Object.values(prescriptions).reduce((s, list) => s + list.length, 0);

  return (
    <>
      <PatientShell
        active="/doctor/patients"
        nav={DOCTOR_NAV}
        home="/doctor/dashboard"
        roleLabel="Médecin"
        status={error ? "error" : loading ? "loading" : "ready"}
        error={error}
        firstName={me?.first_name}
        lastName={me?.last_name}
        eyebrow="DOSSIER MÉDICAL"
        title={fullName}
        subtitle={
          patient
            ? `CIN ${patient.national_id || "—"} · né(e) le ${patient.date_of_birth ? parseLocal(patient.date_of_birth).toLocaleDateString("fr-FR") : "—"}${patient.blood_group && patient.blood_group !== "unknown" ? ` · groupe ${patient.blood_group}` : ""}`
            : ""
        }
        action={
          <button className="ml-btn ml-btn-primary" style={{ marginBottom: 4 }} onClick={() => { setConsultOpen(true); setFormError(""); }}>
            Nouvelle consultation
          </button>
        }
      >
        <button className="ml-back" onClick={() => router.push("/doctor/patients")}>
          ← Retour à la liste
        </button>

        <div className="ml-stats">
          <div className="ml-stat">
            <div className="ml-stat-k">Consultations</div>
            <div className="ml-stat-v">{consultations.length}</div>
            <div className="ml-stat-s">enregistrées</div>
          </div>
          <div className="ml-stat">
            <div className="ml-stat-k">Ordonnances</div>
            <div className="ml-stat-v">{rxCount}</div>
            <div className="ml-stat-s">prescriptions délivrées</div>
          </div>
          <div className="ml-stat">
            <div className="ml-stat-k">Rendez-vous</div>
                      <div className="ml-stat">
            <div className="ml-stat-k">Facturé</div>
            <div className="ml-stat-v">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 })
                .format(invoices.reduce((s, i) => s + (i.amount_due ?? 0), 0))}
            </div>
            <div className="ml-stat-s">
              {invoices.filter((i) => i.status !== "paid").length > 0
                ? `${invoices.filter((i) => i.status !== "paid").length} facture(s) impayée(s)`
                : "tout est réglé"}
            </div>
          </div>
            <div className="ml-stat-v">{appointments.length}</div>
            <div className="ml-stat-s">avec vous</div>
          </div>
        </div>

        <article className="ml-card">
          <div className="ml-card-top">
            <h2>Historique des consultations</h2>
            {consultations.length > 0 && <span className="ml-stat-s">la plus récente en premier</span>}
          </div>

          {consultations.length === 0 ? (
            <div className="ml-empty">
              <p>Aucune consultation enregistrée pour ce patient.</p>
              <button className="ml-btn ml-btn-primary" onClick={() => { setConsultOpen(true); setFormError(""); }}>
                Créer la première consultation
              </button>
            </div>
          ) : (
            consultations.map((c) => (
              <div className="ml-consult" key={c.id}>
                <div className="ml-consult-top">
                  <h3>{c.reason || "Consultation"}</h3>
                  <span className="ml-consult-date">{longDay(c.consultation_date)}</span>
                </div>
                {c.notes && <p className="ml-consult-notes">{c.notes}</p>}

                {(prescriptions[c.id] ?? []).map((rx) => (
                  <div className="ml-rx-line" key={rx.id}>
                    <i className="ml-rx-dot" />
                    <div>
                      <div className="ml-rx-name">
                        {rx.medication_name}{rx.dosage ? ` · ${rx.dosage}` : ""}
                      </div>
                      {(rx.duration || rx.instructions) && (
                        <div className="ml-rx-detail">
                          {[rx.duration, rx.instructions].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}></div>

                <button
                  className="ml-btn ml-btn-ghost"
                  style={{ marginTop: 14, padding: "7px 14px", fontSize: 13 }}
                  onClick={() => { setRxTarget(c); setFormError(""); }}
                >
                  Ajouter une prescription
                </button>
              </div>
            ))
          )}
        </article>
      </PatientShell>

      {consultOpen && (
        <div className="ml-overlay" onClick={() => setConsultOpen(false)}>
          <form className="ml-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitConsultation}>
            <h3 className="ml-modal-title">Nouvelle consultation</h3>
            <p style={{ fontSize: 14, color: "#5a7590", marginTop: 0, marginBottom: 20 }}>{fullName}</p>

            <div style={{ marginBottom: 16 }}>
              <label className="ml-lab">Motif</label>
              <input
                className="ml-field"
                autoFocus
                placeholder="Douleurs abdominales"
                value={consultForm.reason}
                onChange={(e) => setConsultForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>

            <div>
              <label className="ml-lab">Observations</label>
              <textarea
                className="ml-textarea"
                placeholder="Examen clinique, diagnostic, conduite à tenir…"
                value={consultForm.notes}
                onChange={(e) => setConsultForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {formError && <p className="ml-err">{formError}</p>}

            <div className="ml-modal-actions">
              <button type="button" className="ml-btn ml-btn-ghost" onClick={() => setConsultOpen(false)}>Annuler</button>
              <button type="submit" className="ml-btn ml-btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}


            {billTarget && (
        <div className="ml-overlay" onClick={() => setBillTarget(null)}>
          <form className="ml-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitInvoice}>
            <h3 className="ml-modal-title">Facturer la consultation</h3>
            <p style={{ fontSize: 14, color: "#5a7590", marginTop: 0, marginBottom: 20 }}>
              {fullName} · {longDay(billTarget.consultation_date)}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="ml-lab">Description</label>
              <input
                className="ml-field"
                autoFocus
                value={billForm.description}
                onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="ml-lab">Montant (MAD)</label>
              <input
                className="ml-field"
                inputMode="decimal"
                placeholder="300"
                value={billForm.amount_due}
                onChange={(e) => setBillForm((f) => ({ ...f, amount_due: e.target.value }))}
              />
              <p className="ml-hint" style={{ marginTop: 6 }}>
                Le règlement sera enregistré par le secrétariat à l&apos;accueil.
              </p>
            </div>

            {formError && <p className="ml-err">{formError}</p>}

            <div className="ml-modal-actions">
              <button type="button" className="ml-btn ml-btn-ghost" onClick={() => setBillTarget(null)}>Annuler</button>
              <button type="submit" className="ml-btn ml-btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Créer la facture"}
              </button>
            </div>
          </form>
        </div>
      )}

      {rxTarget && (
        <div className="ml-overlay" onClick={() => setRxTarget(null)}>
          <form className="ml-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitPrescription}>
            <h3 className="ml-modal-title">Nouvelle prescription</h3>
            <p style={{ fontSize: 14, color: "#5a7590", marginTop: 0, marginBottom: 20 }}>
              {rxTarget.reason || "Consultation"} · {longDay(rxTarget.consultation_date)}
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="ml-lab">Médicament</label>
              <input
                className="ml-field"
                autoFocus
                value={rxForm.medication_name}
                onChange={(e) => setRxForm((f) => ({ ...f, medication_name: e.target.value }))}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label className="ml-lab">Posologie</label>
                <input
                  className="ml-field"
                  placeholder="500 mg, 3 fois par jour"
                  value={rxForm.dosage}
                  onChange={(e) => setRxForm((f) => ({ ...f, dosage: e.target.value }))}
                />
              </div>
              <div>
                <label className="ml-lab">Durée</label>
                <input
                  className="ml-field"
                  placeholder="7 jours"
                  value={rxForm.duration}
                  onChange={(e) => setRxForm((f) => ({ ...f, duration: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="ml-lab">Instructions</label>
              <textarea
                className="ml-textarea"
                style={{ minHeight: 80 }}
                placeholder="À prendre pendant les repas"
                value={rxForm.instructions}
                onChange={(e) => setRxForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </div>

            {formError && <p className="ml-err">{formError}</p>}

            <div className="ml-modal-actions">
              <button type="button" className="ml-btn ml-btn-ghost" onClick={() => setRxTarget(null)}>Annuler</button>
              <button type="submit" className="ml-btn ml-btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Prescrire"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}