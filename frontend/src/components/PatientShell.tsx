"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import "./patient-shell.css";

const NAV = [
  { href: "/dashboard", label: "Tableau de bord" },
  { href: "/dossier", label: "Mon dossier médical" },
  { href: "/rendez-vous", label: "Mes rendez-vous" },
];

export function parseLocal(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
}

export function longDate(iso: string) {
  return parseLocal(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

export function clock(iso: string) {
  return parseLocal(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export default function PatientShell({
  active,
  eyebrow,
  title,
  subtitle,
  action,
  firstName,
  lastName,
  status,
  error,
  children,
}: {
  active: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  firstName?: string;
  lastName?: string;
  status: "loading" | "error" | "ready";
  error?: string;
  children?: ReactNode;
}) {
  const router = useRouter();

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "??";

  if (status === "error") {
    return (
      <div className="ml-root">
        <div className="ml-state">
          <h1>Accès au dossier impossible</h1>
          {error && <p className="ml-why">{error}</p>}
          <p>
            Votre session a peut-être expiré, ou le compte utilisé n&apos;est pas un compte patient.
            Reconnectez-vous pour continuer.
          </p>
          <div className="ml-actions">
            <button className="ml-btn ml-btn-primary" onClick={logout}>Se reconnecter</button>
            <button className="ml-btn ml-btn-ghost" onClick={() => window.location.reload()}>Réessayer</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="ml-root">
        <div className="ml-state">
          <div className="ml-pulse" />
          <p>Chargement de votre dossier médical…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-root">
      <div className="ml-shell">
        <aside className="ml-rail">
          <Link className="ml-brand" href="/dashboard">Med<em>Link</em></Link>
          <nav className="ml-menu">
            {NAV.map((l) => (
              <Link key={l.href} href={l.href} className={l.href === active ? "ml-on" : ""}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="ml-foot">
            <div className="ml-me">
              <div className="ml-avatar">{initials}</div>
              <div style={{ minWidth: 0 }}>
                <div className="ml-me-name">{firstName} {lastName}</div>
                <div className="ml-me-role">Patient</div>
              </div>
            </div>
            <button className="ml-logout" onClick={logout}>Se déconnecter</button>
          </div>
        </aside>

        <div className="ml-main">
          <div className="ml-band">
            <div className="ml-inner ml-head">
              <div>
                {eyebrow && <p className="ml-eyebrow">{eyebrow}</p>}
                <h1 className="ml-title">{title}</h1>
                {subtitle && <p className="ml-sub">{subtitle}</p>}
              </div>
              {action}
            </div>
          </div>
          <div className="ml-body">
            <div className="ml-inner">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
