"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession, TokenResponse } from "@/lib/api";

export default function ConnexionPage() {
  const router = useRouter();
  const [role, setRole] = useState("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const labels = { patient: "Espace patient", secretary: "Espace secrétaire médicale", doctor: "Espace médecin" };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    try {
      const session = await api<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (session.role !== role) { setError("Ce compte appartient à un autre espace. Sélectionnez le bon rôle."); return; }
      saveSession(session);
      router.push(session.role === "patient" ? "/dashboard" : session.role === "doctor" ? "/doctor/dashboard" : session.role === "secretary" ? "/secretariat" : "/professionnel");
    } catch (err) { setError(err instanceof Error ? err.message : "Connexion impossible."); } finally { setLoading(false); }
  }

  return <main className="authPage"><section className="authPanel"><a className="brand" href="/">MedLink</a><div className="authContent"><p className="eyebrow">CONNEXION SÉCURISÉE</p><h1>Bienvenue.</h1><p className="authText">Choisissez votre espace puis connectez-vous.</p><div className="roleTabs">{(["patient", "secretary", "doctor"] as const).map((item) => <button key={item} type="button" className={role === item ? "selected" : ""} onClick={() => { setRole(item); setError(""); }}>{item === "patient" ? "Patient" : item === "secretary" ? "Secrétaire" : "Médecin"}</button>)}</div><form onSubmit={handleSubmit}><p className="selectedRole">{labels[role]}</p><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" placeholder="vous@exemple.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><label htmlFor="password">Mot de passe</label><input id="password" type="password" placeholder="Votre mot de passe" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="formError">{error}</p>}<button className="button authButton" type="submit" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}</button></form><p className="formHint">Vous n’avez pas de compte ? <a href="/inscription">Créer un accès</a></p></div></section><aside className="authAside"><p className="eyebrow">MEDLINK</p><h2>Chaque accès est protégé selon le rôle de son utilisateur.</h2><p>Le patient consulte son dossier, le médecin soigne et la secrétaire gère l’accueil administratif.</p></aside></main>;
}
