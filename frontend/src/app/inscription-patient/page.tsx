"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { api, saveSession, TokenResponse } from "@/lib/api";

export default function PatientRegistration() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    <main className="authPage">
      <section className="authPanel">
        <a className="brand" href="/">MedLink</a>
        <div className="authContent">
          <p className="eyebrow">ESPACE PATIENT</p>
          <h1>Créer mon compte</h1>
          <form onSubmit={submit}>
            <div className="formRow">
              <div>
                <label>Prénom</label>
                <input name="firstName" required />
              </div>
              <div>
                <label>Nom</label>
                <input name="lastName" required />
              </div>
            </div>

            <label>E-mail</label>
            <input name="email" type="email" required />

            <label>Date de naissance</label>
            <input name="birthDate" type="date" required />

            <label>Sexe</label>
            <select name="sex">
              <option value="">Non précisé</option>
              <option value="female">Femme</option>
              <option value="male">Homme</option>
            </select>

            <label>Mot de passe</label>
            <input name="password" type="password" minLength={8} required />

            {error && <p className="formError">{error}</p>}

            <button className="button authButton" disabled={loading}>
              {loading ? "Création..." : "Créer mon compte"}
            </button>
          </form>

          {/* Lien de connexion placé directement sous le formulaire */}
          <p className="formFooterNote" style={{ marginTop: "20px", textAlign: "center" }}>
            Vous avez déjà un compte ?{" "}
            <a href="/connexion" style={{ color: "#0284c7", fontWeight: 600, textDecoration: "none" }}>
              Se connecter
            </a>
          </p>
        </div>
      </section>
      <aside className="authAside">
        <p className="eyebrow">MEDLINK</p>
        <h2>Votre dossier vous accompagne, sous votre contrôle.</h2>
      </aside>
    </main>
  );
}