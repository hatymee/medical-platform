"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, CircleAlert } from "lucide-react";
import { api, saveSession, TokenResponse } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";

export default function PatientRegistration() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const session = await api<TokenResponse>("/auth/register/patient", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
          first_name: data.get("firstName"),
          last_name: data.get("lastName"),
          date_of_birth: data.get("birthDate"),
          sex: data.get("sex") || null,
        }),
      });
      saveSession(session);
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Inscription impossible.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout headline="Votre dossier vous accompagne, sous votre contrôle.">
      <h1>Créer mon compte</h1>
      <p className="au-lead">Quelques informations suffisent. Le secrétariat complètera votre dossier lors de votre première visite.</p>

      <form onSubmit={submit}>
        <div className="au-row">
          <div>
            <label className="au-label" htmlFor="firstName">Prénom</label>
            <div className="au-field"><input id="firstName" className="au-input plain" name="firstName" autoComplete="given-name" required /></div>
          </div>
          <div>
            <label className="au-label" htmlFor="lastName">Nom</label>
            <div className="au-field"><input id="lastName" className="au-input plain" name="lastName" autoComplete="family-name" required /></div>
          </div>
        </div>

        <label className="au-label" htmlFor="email">Adresse e-mail</label>
        <div className="au-field">
          <Mail size={18} />
          <input id="email" className="au-input" name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required />
        </div>

        <div className="au-row">
          <div>
            <label className="au-label" htmlFor="birthDate">Date de naissance</label>
            <div className="au-field"><input id="birthDate" className="au-input plain" name="birthDate" type="date" max={today} required /></div>
          </div>
          <div>
            <label className="au-label" htmlFor="sex">Sexe</label>
            <div className="au-field">
              <select id="sex" className="au-input plain" name="sex" defaultValue="">
                <option value="">Non précisé</option>
                <option value="F">Femme</option>
                <option value="M">Homme</option>
              </select>
            </div>
          </div>
        </div>

        <label className="au-label" htmlFor="password">Mot de passe</label>
        <div className="au-field">
          <Lock size={18} />
          <input id="password" className="au-input" name="password" type={showPwd ? "text" : "password"} minLength={8} autoComplete="new-password" placeholder="Huit caractères minimum" required />
          <button type="button" className="au-eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="au-error"><CircleAlert size={18} style={{ flexShrink: 0 }} />{error}</p>}

        <button className="au-btn" disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
        </button>
      </form>

      <p className="au-hint">Vous avez déjà un compte ? <a href="/connexion">Se connecter</a></p>
    </AuthLayout>
  );
}
