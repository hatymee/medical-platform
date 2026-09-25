"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  Home, FolderOpen, CalendarDays, Users, TrendingUp, Receipt, LogOut, Bell, ChevronDown, LayoutGrid, Building2, FileText, ShieldCheck, Search, ChevronRight,
} from "lucide-react";
import "./patient-shell.css";

export const PATIENT_NAV = [
  { href: "/dashboard", label: "Accueil" },
  { href: "/dossier", label: "Mon dossier" },
  { href: "/rendez-vous", label: "Rendez-vous" },
  { href: "/dossier#documents", label: "Mes documents" },
  { href: "/dossier#factures", label: "Mes factures" },
];

export const DOCTOR_NAV = [
  { href: "/doctor/dashboard", label: "Accueil" },
  { href: "/doctor/patients", label: "Mes patients" },
  { href: "/doctor/tarifs", label: "Mes tarifs" },
  { href: "/professionnel", label: "Facturation" },
];

const NAV_ICONS: Record<string, typeof Home> = {
  "/dashboard": Home,
  "/dossier": FolderOpen,
  "/dossier#documents": FileText,
  "/dossier#factures": Receipt,
  "/rendez-vous": CalendarDays,
  "/doctor/dashboard": Home,
  "/doctor/patients": Users,
  "/doctor/tarifs": Receipt,
  "/professionnel": TrendingUp,
  "/admin": Building2,
};

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
  nav = PATIENT_NAV,
  home = "/dashboard",
  roleLabel = "Patient",
  eyebrow,
  title,
  subtitle,
  action,
  firstName,
  lastName,
  status,
  error,
  children,
  onSearch,
  searchPlaceholder = "Rechercher…",
  notifCount = 0,
}: {
  active: string;
  nav?: { href: string; label: string }[];
  home?: string;
  roleLabel?: string;
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  firstName?: string;
  lastName?: string;
  status: "loading" | "error" | "ready";
  error?: string;
  children?: ReactNode;
  onSearch?: (query: string) => void;
  searchPlaceholder?: string;
  notifCount?: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState<Date | null>(null);
  const [query, setQuery] = useState("");
  const isPatient = roleLabel === "Patient";

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  const day = now ? now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "";
  const time = now ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
  const tag = eyebrow ? eyebrow.charAt(0) + eyebrow.slice(1).toLowerCase() : roleLabel;

  if (status === "error") {
    return (
      <div className="ml-root">
        <div className="ml-state">
          <h1>Accès impossible</h1>
          {error && <p className="ml-why">{error}</p>}
          <p>
            Votre session a peut-être expiré, ou votre compte n&apos;a pas les droits nécessaires.
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
          <p>Chargement en cours…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ml-root">
      <div className="ml-shell">
        <aside className="ml-rail">
          <Link className="ml-brand" href={home}>
            <span className="ml-logo">+</span>
            <span>
              <span className="ml-brand-name">Med<em>Link</em></span>
              <span className="ml-brand-tag">Votre santé, notre priorité</span>
            </span>
          </Link>

          <nav className="ml-menu">
            {nav.map((l) => {
              const Icon = NAV_ICONS[l.href] ?? LayoutGrid;
              return (
                <Link key={l.href} href={l.href} className={l.href === active ? "ml-on" : ""}>
                  <Icon size={20} />
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </nav>

          {isPatient ? (
            <div className="ml-promo">
              <div className="ml-promo-head"><ShieldCheck size={24} className="ml-promo-shield" /> Votre santé en sécurité</div>
              <p>Vos données sont protégées et uniquement accessibles aux professionnels autorisés.</p>
            </div>
          ) : (
            <div className="ml-promo-space" />
          )}

          <div className="ml-foot">
            <div className="ml-me">
              <div className="ml-avatar">{initials}</div>
              <div style={{ minWidth: 0, flexGrow: 1 }}>
                <div className="ml-me-name">{firstName} {lastName}</div>
                <div className="ml-me-role">{roleLabel}</div>
              </div>
              <ChevronRight size={16} />
            </div>
            <button className="ml-logout" onClick={logout}>
              <LogOut size={18} /> Déconnexion
            </button>
          </div>
        </aside>

        <div className="ml-main">
          <header className="ml-top">
            {onSearch ? (
              <form
                className="ml-search"
                role="search"
                onSubmit={(e) => { e.preventDefault(); onSearch(query.trim()); }}
              >
                <Search size={18} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
              </form>
            ) : (
              <div className="ml-top-tag">{tag}</div>
            )}
            <div className="ml-top-right">
              <span className="ml-bell" aria-label={`${notifCount} notification(s)`}>
                <Bell size={21} />
                {notifCount > 0 && <span className="ml-bell-badge">{notifCount > 9 ? "9+" : notifCount}</span>}
              </span>
              <span className="ml-top-sep" />
              <div className="ml-top-date">
                <span>{day.charAt(0).toUpperCase() + day.slice(1)}</span>
                <b>{time}</b>
              </div>
              <div className="ml-top-me">
                <span className="ml-avatar">{initials}</span>
                <ChevronDown size={16} />
              </div>
            </div>
          </header>

          {(title || subtitle || action) && (
            <div className="ml-band">
              <div className="ml-inner ml-head">
                <div>
                  <h1 className="ml-title">{title}</h1>
                  {subtitle && <p className="ml-sub">{subtitle}</p>}
                </div>
                {action}
              </div>
            </div>
          )}
          <div className="ml-body">
            <div className="ml-inner">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
