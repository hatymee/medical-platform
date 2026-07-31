"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession, TokenResponse } from "@/lib/api";

export default function InscriptionPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const data = new FormData(event.currentTarget);
    try {
      const session = await api<TokenResponse>("/auth/register/patient", { method: "POST", body: JSON.stringify({ email: data.get("email"), password: data.get("password"), first_name: data.get("firstName"), last_name: data.get("lastName"), date_of_birth: data.get("birthDate"), sex: data.get("sex") || null, blood_group: data.get("bloodGroup") || "unknown" }) });
      saveSession(session); router.push("/dashboard");
    } catch (err) { setError(err instanceof Error ? err.message : "Inscription impossible."); } finally { setLoading(false); }
  }
  return <main className="authPage"><section className="authPanel"><a className="brand" href="/">MedLink</a><div className="authContent"><p className="eyebrow">NOUVEAU PATIENT</p><h1>Créer un compte</h1><form onSubmit={submit}><div className="formRow"><div><label htmlFor="firstName">Prénom</label><input id="firstName" name="firstName" required /></div><div><label htmlFor="lastName">Nom</label><input id="lastName" name="lastName" required /></div></div><label htmlFor="email">Adresse e-mail</label><input id="email" name="email" type="email" required /><label htmlFor="birthDate">Date de naissance</label><input id="birthDate" name="birthDate" type="date" required /><label htmlFor="sex">Sexe</label><select id="sex" name="sex"><option value="">Non précisé</option><option value="female">Femme</option><option value="male">Homme</option></select><label htmlFor="bloodGroup">Groupe sanguin</label><select id="bloodGroup" name="bloodGroup"><option value="unknown">Inconnu</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option><option>O+</option><option>O-</option></select><label htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" minLength={8} required />{error && <p className="formError">{error}</p>}<button className="button authButton" disabled={loading}>{loading ? "Création..." : "Créer mon compte"}</button></form><p className="formHint">Déjà inscrit ? <a href="/connexion">Se connecter</a></p></div></section><aside className="authAside"><p className="eyebrow">MEDLINK</p><h2>Un profil médical numérique, sous votre contrôle.</h2></aside></main>;
}
