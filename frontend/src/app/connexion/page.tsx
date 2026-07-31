"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession, TokenResponse } from "@/lib/api";

export default function ConnexionPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setLoading(true);
    try {
      const session = await api<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      saveSession(session);
      router.push(session.role === "patient" ? "/dashboard" : "/professionnel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally { setLoading(false); }
  }

  return <main className="authPage"><section className="authPanel"><a className="brand" href="/">MedLink</a><div className="authContent"><p className="eyebrow">ESPACE SÉCURISÉ</p><h1>Bienvenue.</h1><p className="authText">Connectez-vous pour accéder à votre espace médical.</p><form onSubmit={handleSubmit}><label htmlFor="email">Adresse e-mail</label><input id="email" type="email" placeholder="vous@exemple.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><label htmlFor="password">Mot de passe</label><input id="password" type="password" placeholder="Votre mot de passe" value={password} onChange={(event) => setPassword(event.target.value)} required />{error && <p className="formError">{error}</p>}<button className="button authButton" type="submit" disabled={loading}>{loading ? "Connexion..." : "Se connecter"}</button></form><p className="formHint">Nouveau patient ? <a href="/inscription">Créer un compte</a></p></div></section><aside className="authAside"><p className="eyebrow">MEDLINK</p><h2>Votre parcours médical reste accessible et protégé.</h2><p>Vos informations sont partagées uniquement avec les professionnels autorisés.</p></aside></main>;
}
