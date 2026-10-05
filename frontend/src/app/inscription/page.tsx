"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User, Mail, Phone, Lock, Eye, EyeOff, CalendarDays, CalendarCheck, FolderOpen, Activity, ShieldCheck, CircleAlert, Info,
} from "lucide-react";
import { api, saveSession, TokenResponse } from "@/lib/api";

type Role = "patient" | "doctor" | "secretary" | "admin";

const ROLES: { id: Role; label: string }[] = [
  { id: "patient", label: "Patient" },
  { id: "doctor", label: "Médecin" },
  { id: "secretary", label: "Secrétaire" },
  { id: "admin", label: "Administrateur" },
];

export default function InscriptionPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role>("patient");
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const fullName = String(data.get("fullName") ?? "").trim().replace(/\s+/g, " ");
    const parts = fullName.split(" ");
    if (parts.length < 2) {
      setError("Indiquez votre prénom et votre nom, séparés par un espace.");
      return;
    }
    const password = String(data.get("password") ?? "");
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== String(data.get("password2") ?? "")) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const session = await api<TokenResponse>("/auth/register/patient", {
        method: "POST",
        body: JSON.stringify({
          first_name: parts[0],
          last_name: parts.slice(1).join(" "),
          email: data.get("email"),
          phone: String(data.get("phone") ?? "").trim() || null,
          date_of_birth: data.get("birthDate"),
          sex: data.get("sex") || null,
          password,
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
    <main className="rg">
      <section className="rg-hero">
        <span className="rg-plus rg-plus-1">+</span>
        <span className="rg-plus rg-plus-2">+</span>
        <span className="rg-plus rg-plus-3">+</span>
        <a className="rg-brand" href="/">
          <span className="rg-logo">+</span>
          <span>
            <span className="rg-brand-name">Med<em>Link</em></span>
            <span className="rg-brand-tag">Votre santé, notre priorité</span>
          </span>
        </a>
        <div className="rg-hero-body">
          <h1>Une plateforme médicale moderne et complète</h1>
          <p>Gérez vos rendez-vous, accédez à vos documents et suivez votre santé en toute simplicité.</p>
          <ul>
            <li><span><CalendarCheck size={20} /></span><div><b>Prise de rendez-vous en ligne</b><small>Rapide et facile</small></div></li>
            <li><span><FolderOpen size={20} /></span><div><b>Accès à vos documents médicaux</b><small>En toute sécurité</small></div></li>
            <li><span><Activity size={20} /></span><div><b>Suivi de votre santé</b><small>À tout moment</small></div></li>
          </ul>
        </div>
      </section>

      <section className="rg-side">
        <div className="rg-card">
          <h2>Créer votre compte</h2>
          <p className="rg-lead">Rejoignez MedLink et accédez à vos services de santé.</p>

          <div className="rg-tabs" role="tablist" aria-label="Type de compte">
            {ROLES.map((r) => (
              <button key={r.id} type="button" role="tab" aria-selected={role === r.id} className={`rg-tab ${role === r.id ? "on" : ""}`} onClick={() => { setRole(r.id); setError(""); }}>
                {r.label}
              </button>
            ))}
          </div>

          {role === "patient" ? (
            <form onSubmit={submit}>
              <div className="rg-field">
                <User size={18} />
                <input name="fullName" placeholder="Nom complet (prénom et nom)" autoComplete="name" required aria-label="Nom complet" />
              </div>
              <div className="rg-field">
                <Mail size={18} />
                <input name="email" type="email" placeholder="Email" autoComplete="email" required aria-label="Email" />
              </div>
              <div className="rg-field">
                <Phone size={18} />
                <input name="phone" type="tel" placeholder="Téléphone" autoComplete="tel" aria-label="Téléphone" />
              </div>
              <div className="rg-row">
                <div className="rg-field">
                  <CalendarDays size={18} />
                  <input name="birthDate" type="date" max={today} required aria-label="Date de naissance" title="Date de naissance" />
                </div>
                <div className="rg-field rg-field-plain">
                  <select name="sex" defaultValue="" aria-label="Sexe">
                    <option value="">Sexe (facultatif)</option>
                    <option value="F">Femme</option>
                    <option value="M">Homme</option>
                  </select>
                </div>
              </div>
              <div className="rg-field">
                <Lock size={18} />
                <input name="password" type={showPwd ? "text" : "password"} placeholder="Mot de passe (8 caractères minimum)" autoComplete="new-password" required aria-label="Mot de passe" />
                <button type="button" className="rg-eye" onClick={() => setShowPwd((v) => !v)} aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="rg-field">
                <Lock size={18} />
                <input name="password2" type={showPwd2 ? "text" : "password"} placeholder="Confirmer le mot de passe" autoComplete="new-password" required aria-label="Confirmer le mot de passe" />
                <button type="button" className="rg-eye" onClick={() => setShowPwd2((v) => !v)} aria-label={showPwd2 ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                  {showPwd2 ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {error && <p className="rg-error"><CircleAlert size={18} />{error}</p>}

              <button className="rg-btn" disabled={loading}>{loading ? "Création du compte…" : "S'inscrire"}</button>
            </form>
          ) : (
            <div className="rg-staff">
              <span className="rg-staff-ic"><Info size={22} /></span>
              <div>
                <b>Compte {role === "doctor" ? "médecin" : role === "secretary" ? "secrétaire" : "administrateur"}</b>
                <p>
                  {role === "admin"
                    ? "Les comptes administrateur sont créés lors de l'ouverture d'un cabinet sur MedLink. Contactez l'équipe MedLink pour inscrire votre cabinet."
                    : "Pour des raisons de sécurité, ce compte est créé par l'administrateur de votre cabinet. Il vous communiquera vos identifiants."}
                </p>
                <a className="rg-btn rg-btn-inline" href="/connexion">J&apos;ai déjà mes identifiants</a>
              </div>
            </div>
          )}

          <p className="rg-hint">Déjà un compte ? <a href="/connexion">Se connecter</a></p>

          <div className="rg-secure">
            <ShieldCheck size={22} />
            <span>Vos données sont protégées et sécurisées, conformément aux normes de confidentialité.</span>
          </div>
        </div>
      </section>

      <style jsx global>{`
        .rg { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); background: #eef4fb; color: #0a2540; }
        .rg-hero {
          position: relative; overflow: hidden; display: flex; flex-direction: column; padding: 40px 56px;
          background:
            radial-gradient(80% 60% at 85% 90%, rgba(120, 190, 255, 0.45) 0%, rgba(120, 190, 255, 0) 60%),
            linear-gradient(155deg, #0d3a6e 0%, #1464c7 55%, #3b8ee8 100%);
          color: #fff;
        }
        .rg-plus { position: absolute; font-weight: 800; color: rgba(255, 255, 255, 0.35); pointer-events: none; }
        .rg-plus-1 { right: 18%; top: 34%; font-size: 64px; }
        .rg-plus-2 { right: 8%; bottom: 22%; font-size: 90px; color: rgba(255, 255, 255, 0.25); }
        .rg-plus-3 { left: 52%; bottom: 10%; font-size: 40px; }
        .rg-brand { display: flex; align-items: center; gap: 12px; color: #fff; text-decoration: none; position: relative; }
        .rg-logo { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #fff; color: #1877e0; font-size: 30px; font-weight: 800; }
        .rg-brand-name { display: block; font-size: 28px; font-weight: 800; letter-spacing: -0.03em; }
        .rg-brand-name em { font-style: normal; color: #9ccaff; }
        .rg-brand-tag { display: block; font-size: 13px; color: #cfe3fa; }
        .rg-hero-body { margin: auto 0; max-width: 520px; position: relative; }
        .rg-hero h1 { max-width: none; margin: 0 0 16px; font-size: 40px; line-height: 1.15; font-weight: 800; letter-spacing: -0.02em; }
        .rg-hero p { margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #dbeafb; }
        .rg-hero ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 18px; }
        .rg-hero li { display: flex; align-items: center; gap: 14px; }
        .rg-hero li > span { width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.14); border: 1px solid rgba(255, 255, 255, 0.2); }
        .rg-hero li b { display: block; font-size: 15px; }
        .rg-hero li small { display: block; font-size: 13px; color: #cfe3fa; margin-top: 2px; }

        .rg-side { display: flex; align-items: center; justify-content: center; padding: 40px; }
        .rg-card { width: 100%; max-width: 520px; padding: 36px 36px 28px; background: #fff; border-radius: 20px; box-shadow: 0 24px 60px rgba(10, 37, 64, 0.1); }
        .rg-card h2 { margin: 0 0 6px; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }
        .rg-lead { margin: 0 0 22px; font-size: 14px; color: #5a7590; }
        .rg-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; padding: 4px; margin-bottom: 20px; border: 1px solid #e1eaf3; border-radius: 10px; }
        .rg-tab { padding: 10px 4px; border: none; border-radius: 7px; background: none; font: inherit; font-size: 13px; font-weight: 500; color: #34506d; cursor: pointer; }
        .rg-tab:hover { color: #1877e0; }
        .rg-tab.on { background: #1877e0; color: #fff; font-weight: 700; }
        .rg-field { position: relative; margin-bottom: 12px; }
        .rg-field > svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #7d97b2; pointer-events: none; }
        .rg-field input, .rg-field select {
          width: 100%; box-sizing: border-box; padding: 13px 44px 13px 44px; font: inherit; font-size: 14px; color: #0a2540;
          background: #fff; border: 1px solid #d9e4ef; border-radius: 10px;
        }
        .rg-field-plain select { padding-left: 14px; padding-right: 14px; }
        .rg-field input:focus, .rg-field select:focus { outline: none; border-color: #1877e0; box-shadow: 0 0 0 4px rgba(24, 119, 224, 0.14); }
        .rg-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .rg-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: none; color: #7d97b2; cursor: pointer; }
        .rg-eye:hover { background: #eaf3fd; color: #1877e0; }
        .rg-error { display: flex; gap: 8px; align-items: flex-start; margin: 4px 0 14px; padding: 11px 14px; border-radius: 10px; background: #fcebeb; color: #cf3a3a; font-size: 14px; font-weight: 600; }
        .rg-error svg { flex-shrink: 0; }
        .rg-btn { width: 100%; display: inline-flex; align-items: center; justify-content: center; margin-top: 8px; padding: 14px 18px; border: none; border-radius: 10px; background: #1877e0; color: #fff; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; text-decoration: none; box-shadow: 0 6px 16px rgba(24, 119, 224, 0.3); }
        .rg-btn:hover { background: #0f5cbf; }
        .rg-btn:disabled { opacity: 0.6; cursor: default; }
        .rg-btn-inline { width: auto; margin-top: 14px; padding: 11px 18px; font-size: 14px; }
        .rg-staff { display: flex; gap: 14px; padding: 18px; border-radius: 12px; background: #f3f8fe; border: 1px solid #e1eaf3; }
        .rg-staff-ic { width: 42px; height: 42px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: #fff; color: #1877e0; }
        .rg-staff b { font-size: 15px; }
        .rg-staff p { margin: 6px 0 0; font-size: 14px; line-height: 1.55; color: #34506d; }
        .rg-hint { margin: 20px 0 0; text-align: center; font-size: 14px; color: #1877e0; }
        .rg-hint a { color: #1877e0; font-weight: 700; text-decoration: none; }
        .rg-hint a:hover { text-decoration: underline; }
        .rg-secure { display: flex; align-items: center; gap: 12px; margin-top: 22px; padding: 14px 16px; border-radius: 12px; background: #f3f8fe; font-size: 12px; line-height: 1.5; color: #1877e0; }
        .rg-secure svg { flex-shrink: 0; }
        .rg-tab:focus-visible, .rg-btn:focus-visible, .rg-eye:focus-visible { outline: 3px solid rgba(24, 119, 224, 0.35); outline-offset: 2px; }
        @media (max-width: 1000px) {
          .rg { grid-template-columns: 1fr; }
          .rg-hero { padding: 28px; }
          .rg-hero-body { margin: 28px 0 8px; }
          .rg-hero h1 { font-size: 30px; }
          .rg-side { padding: 20px; }
          .rg-card { padding: 24px; }
          .rg-tabs { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </main>
  );
}
