"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession, TokenResponse } from "@/lib/api";

export default function ProfessionalRegistration() {
  const router = useRouter();
  const [role, setRole] = useState("doctor");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const data = new FormData(event.currentTarget);
    const body = { email: data.get("email"), password: data.get("password"), first_name: data.get("firstName"), last_name: data.get("lastName") };
    try { const session = await api<TokenResponse>(role === "doctor" ? "/auth/register/doctor" : "/auth/register/secretary", { method: "POST", body: JSON.stringify(body) }); saveSession(session); router.push(role === "doctor" ? "/professionnel" : "/secretariat"); }
    catch (err) { setError(err instanceof Error ? err.message : "Création impossible."); } finally { setLoading(false); }
  }
  return <main className="authPage"><section className="authPanel"><a className="brand" href="/">MedLink</a><div className="authContent"><p className="eyebrow">ESPACE PROFESSIONNEL</p><h1>Créer un compte</h1><form onSubmit={submit}><label>Fonction</label><select value={role} onChange={(event) => setRole(event.target.value)}><option value="doctor">Médecin</option><option value="secretary">Secrétaire médicale</option></select><div className="formRow"><div><label>Prénom</label><input name="firstName" required /></div><div><label>Nom</label><input name="lastName" required /></div></div><label>E-mail professionnel</label><input name="email" type="email" required /><label>Mot de passe</label><input name="password" type="password" minLength={8} required />{error && <p className="formError">{error}</p>}<button className="button authButton" disabled={loading}>{loading ? "Création..." : "Créer le compte"}</button></form></div></section><aside className="authAside"><p className="eyebrow">MEDLINK</p><h2>Un accès adapté à chaque responsabilité.</h2><p>Le médecin gère le soin. La secrétaire gère l’accueil, les documents et les règlements.</p></aside></main>;
}
