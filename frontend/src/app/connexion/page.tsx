"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, User, UserRound, Stethoscope, Building2, CircleAlert } from "lucide-react";
import { api, saveSession, TokenResponse } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";

type Role = "patient" | "secretary" | "doctor" | "clinic_admin";

const ROLES: { id: Role; label: string; icon: typeof User; space: string }[] = [
  { id: "patient", label: "Patient", icon: User, space: "Espace patient" },
  { id: "secretary", label: "Secrétaire", icon: UserRound, space: "Espace secrétariat" },
  { id: "doctor", label: "Médecin", icon: Stethoscope, space: "Espace médecin" },
  { id: "clinic_admin", label: "Cabinet", icon: Building2, space: "Administration du cabinet" },
];

const HOME: Record<string, string> = {
  patient: "/dashboard",
  doctor: "/doctor/dashboard",
  secretary: "/secretariat",
  clinic_admin: "/admin",
};

export default function ConnexionPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("patient");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const session = await api<TokenResponse>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      if (session.role !== role) {
        const right = ROLES.find((r) => r.id === session.role);
        setError(`Ce compte appartient à l'onglet « ${right?.label ?? session.role} ». Sélectionnez-le puis reconnectez-vous.`);
        setLoading(false);
        return;
      }
      saveSession(session);
      router.push(HOME[session.role] ?? "/professionnel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connexion impossible.");
    } finally {
      setLoading(false);
    }
  }

  const current = ROLES.find((r) => r.id === role)!;

  return (
    <AuthLayout headline="Chaque accès est protégé selon le rôle de son utilisateur.">
      <h1>Bienvenue</h1>
      <p className="au-lead">Choisissez votre espace, puis connectez-vous avec votre adresse e-mail.</p>

      <div className="au-tabs" role="tablist" aria-label="Espace de connexion">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={role === r.id}
            className={`au-tab ${role === r.id ? "on" : ""}`}
            onClick={() => { setRole(r.id); setError(""); }}
          >
            <r.icon size={19} />
            {r.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} aria-label={current.space}>
        <label className="au-label" htmlFor="email">Adresse e-mail</label>
        <div className="au-field">
          <Mail size={18} />
          <input id="email" className="au-input" type="email" autoComplete="email" placeholder="vous@exemple.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <label className="au-label" htmlFor="password">Mot de passe</label>
        <div className="au-field">
          <Lock size={18} />
          <input id="password" className="au-input" type={showPwd ? "text" : "password"} autoComplete="current-password" placeholder="Votre mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button type="button" className="au-eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
            {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {error && <p className="au-error"><CircleAlert size={18} style={{ flexShrink: 0 }} />{error}</p>}

        <button className="au-btn" type="submit" disabled={loading}>
          {loading ? "Connexion…" : `Se connecter à l'${current.space.toLowerCase()}`}
        </button>
      </form>

      <p className="au-hint">Vous n&apos;avez pas de compte ? <a href="/inscription">Créer un accès</a></p>
    </AuthLayout>
  );
}
