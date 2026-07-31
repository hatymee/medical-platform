"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Appointment } from "@/lib/api";

const showDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(new Date(value));

export default function RendezVousPage() {
  const router = useRouter(); const [items, setItems] = useState<Appointment[]>([]); const [error, setError] = useState("");
  async function load() { try { setItems(await api<Appointment[]>("/appointments/mine")); } catch (err) { setError(err instanceof Error ? err.message : "Impossible de charger les rendez-vous."); } }
  useEffect(() => { if (!localStorage.getItem("medical_token")) router.replace("/connexion"); else void load(); }, [router]);
  async function cancel(id: string) { if (!confirm("Annuler ce rendez-vous ?")) return; try { await api<Appointment>(`/appointments/${id}/cancel`, { method: "PATCH" }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Annulation impossible."); } }
  return <main className="contentPage"><header className="simpleHeader"><a className="brand" href="/dashboard">MedLink</a><nav><a href="/dashboard">Tableau de bord</a><a href="/dossier">Mon dossier</a></nav></header><section className="pageHeading"><p className="eyebrow">ESPACE PATIENT</p><h1>Mes rendez-vous</h1><p>Suivez vos consultations programmées et leur état.</p></section>{error && <p className="formError">{error}</p>}<section className="listCard">{items.length ? items.map((item) => <article className="appointmentRow" key={item.id}><div><h2>{item.reason || "Consultation médicale"}</h2><p>{showDate(item.scheduled_at)}</p><small>Statut : {item.status}</small></div>{item.status === "scheduled" && <button className="secondaryButton" onClick={() => cancel(item.id)}>Annuler</button>}</article>) : <p className="emptyText">Aucun rendez-vous enregistré.</p>}</section></main>;
}
