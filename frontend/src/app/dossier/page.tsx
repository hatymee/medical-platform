"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Consultation, MedicalDocument, Patient, Prescription } from "@/lib/api";

type RecordData = { patient: Patient; documents: MedicalDocument[]; consultations: Consultation[]; prescriptions: Prescription[] };
const date = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(value));

export default function DossierPage() {
  const router = useRouter(); const [record, setRecord] = useState<RecordData | null>(null); const [error, setError] = useState("");
  useEffect(() => { if (!localStorage.getItem("medical_token")) { router.replace("/connexion"); return; } (async () => { try { const patient = await api<Patient>("/patients/me"); const [documents, consultations] = await Promise.all([api<MedicalDocument[]>(`/documents/patient/${patient.id}`), api<Consultation[]>(`/consultations/patient/${patient.id}`)]); const prescriptions = (await Promise.all(consultations.map((item) => api<Prescription[]>(`/consultations/${item.id}/prescriptions`)))).flat(); setRecord({ patient, documents, consultations, prescriptions }); } catch (err) { setError(err instanceof Error ? err.message : "Impossible de charger le dossier."); } })(); }, [router]);
  if (error) return <main className="pageState"><h1>Dossier indisponible</h1><p>{error}</p></main>;
  if (!record) return <main className="pageState"><p>Chargement du dossier médical…</p></main>;
  return <main className="contentPage"><header className="simpleHeader"><a className="brand" href="/dashboard">MedLink</a><nav><a href="/dashboard">Tableau de bord</a><a href="/rendez-vous">Mes rendez-vous</a></nav></header><section className="pageHeading"><p className="eyebrow">DOSSIER PATIENT</p><h1>{record.patient.first_name} {record.patient.last_name}</h1><p>Né(e) le {date(record.patient.date_of_birth)} · Groupe sanguin : {record.patient.blood_group}</p></section><section className="recordGrid"><article className="listCard"><h2>Consultations</h2>{record.consultations.length ? record.consultations.map((item) => <div className="recordItem" key={item.id}><strong>{date(item.consultation_date)}</strong><p>{item.reason || "Consultation"}</p><small>{item.notes || "Aucune note disponible."}</small></div>) : <p className="emptyText">Aucune consultation enregistrée.</p>}</article><article className="listCard"><h2>Ordonnances</h2>{record.prescriptions.length ? record.prescriptions.map((item) => <div className="recordItem" key={item.id}><strong>{item.medication_name}{item.dosage ? ` · ${item.dosage}` : ""}</strong><p>{item.instructions || item.duration || "Prescription médicale"}</p></div>) : <p className="emptyText">Aucune ordonnance enregistrée.</p>}</article><article className="listCard"><h2>Documents</h2>{record.documents.length ? record.documents.map((item) => <div className="recordItem" key={item.id}><strong>{item.title}</strong><p>{item.category} · {date(item.document_date)}</p><small>{item.file_url}</small></div>) : <p className="emptyText">Aucun document enregistré.</p>}</article></section></main>;
}
