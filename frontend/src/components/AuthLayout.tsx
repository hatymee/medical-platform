"use client";

import type { ReactNode } from "react";
import { ShieldCheck, FolderOpen, CalendarDays } from "lucide-react";

export default function AuthLayout({ children, headline }: { children: ReactNode; headline: string }) {
  return (
    <main className="au">
      <section className="au-panel">
        <a className="au-brand" href="/">
          <span className="au-logo">+</span>
          <span>
            <span className="au-brand-name">Med<em>Link</em></span>
            <span className="au-brand-tag">Votre santé, notre priorité</span>
          </span>
        </a>
        <div className="au-content">{children}</div>
        <p className="au-legal">Données de santé chiffrées et accessibles uniquement aux personnes autorisées.</p>
      </section>

      <aside className="au-aside">
        <div className="au-aside-inner">
          <h2>{headline}</h2>
          <ul>
            <li><span><ShieldCheck size={20} /></span><div><b>Accès sécurisé et traçable</b><p>Chaque rôle ne voit que ce dont il a besoin.</p></div></li>
            <li><span><FolderOpen size={20} /></span><div><b>Dossier médical centralisé</b><p>Consultations, ordonnances et documents au même endroit.</p></div></li>
            <li><span><CalendarDays size={20} /></span><div><b>Rendez-vous simplifiés</b><p>Réservation en ligne et suivi par le secrétariat.</p></div></li>
          </ul>
          <div className="au-card">
            <span className="au-card-logo">+</span>
            <p>Une gestion médicale plus simple, plus rapide, plus humaine.</p>
          </div>
        </div>
      </aside>

      <style jsx global>{`
        .au { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); background: #f4f8fc; color: #0a2540; font-family: inherit; }
        .au-panel { display: flex; flex-direction: column; padding: 32px 56px; background: #fff; }
        .au-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: #0a2540; }
        .au-logo { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #1877e0; color: #fff; font-size: 26px; font-weight: 800; box-shadow: 0 6px 16px rgba(24, 119, 224, 0.35); }
        .au-brand-name { display: block; font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
        .au-brand-name em { font-style: normal; color: #1877e0; }
        .au-brand-tag { display: block; font-size: 12px; color: #5a7590; }
        .au-content { width: 100%; max-width: 440px; margin: auto; padding: 40px 0; }
        .au-content h1 { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 8px; }
        .au-lead { font-size: 15px; line-height: 1.6; color: #5a7590; margin: 0 0 26px; }
        .au-legal { font-size: 12px; color: #8aa0b8; margin: 0; }

        .au-tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 5px; margin-bottom: 24px; background: #f1f5fa; border-radius: 12px; }
        .au-tab { display: flex; flex-direction: column; align-items: center; gap: 5px; padding: 10px 4px; border: none; border-radius: 9px; background: none; font: inherit; font-size: 13px; font-weight: 500; color: #5a7590; cursor: pointer; }
        .au-tab:hover { color: #0a2540; }
        .au-tab.on { background: #fff; color: #1877e0; font-weight: 700; box-shadow: 0 2px 8px rgba(10, 37, 64, 0.08); }

        .au-label { display: block; font-size: 13px; font-weight: 600; color: #0a2540; margin: 0 0 7px; }
        .au-field { position: relative; margin-bottom: 16px; }
        .au-field > svg { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #7d97b2; pointer-events: none; }
        .au-input { width: 100%; box-sizing: border-box; padding: 13px 14px 13px 44px; font: inherit; font-size: 15px; color: #0a2540; background: #fff; border: 1px solid #d9e4ef; border-radius: 10px; }
        .au-input.plain { padding-left: 14px; }
        .au-input:focus { outline: none; border-color: #1877e0; box-shadow: 0 0 0 4px rgba(24, 119, 224, 0.14); }
        .au-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: none; color: #5a7590; cursor: pointer; }
        .au-eye:hover { background: #eaf3fd; color: #1877e0; }
        .au-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

        .au-error { display: flex; gap: 8px; align-items: flex-start; margin: 0 0 16px; padding: 11px 14px; border-radius: 10px; background: #fcebeb; color: #cf3a3a; font-size: 14px; font-weight: 600; }
        .au-btn { width: 100%; display: inline-flex; align-items: center; justify-content: center; gap: 8px; padding: 14px 18px; border: none; border-radius: 10px; background: #1877e0; color: #fff; font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 16px rgba(24, 119, 224, 0.3); }
        .au-btn:hover { background: #0f5cbf; }
        .au-btn:disabled { opacity: 0.6; cursor: default; }
        .au-hint { text-align: center; font-size: 14px; color: #5a7590; margin: 22px 0 0; }
        .au-hint a { color: #1877e0; font-weight: 600; text-decoration: none; }
        .au-hint a:hover { text-decoration: underline; }

        .au-choice { display: flex; align-items: center; gap: 16px; padding: 18px; border: 1px solid #d9e4ef; border-radius: 14px; text-decoration: none; color: #0a2540; background: #fff; }
        .au-choice:hover { border-color: #1877e0; box-shadow: 0 8px 20px rgba(24, 119, 224, 0.12); }
        .au-choice-ic { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #eaf3fd; color: #1877e0; flex-shrink: 0; }
        .au-choice b { display: block; font-size: 16px; }
        .au-choice p { margin: 3px 0 0; font-size: 14px; color: #5a7590; }
        .au-choice > svg:last-child { margin-left: auto; color: #1877e0; }
        .au-note { display: flex; gap: 10px; margin-top: 18px; padding: 12px 14px; border-radius: 10px; background: #eaf3fd; color: #0f5cbf; font-size: 13px; line-height: 1.5; }
        .au-note svg { flex-shrink: 0; margin-top: 1px; }

        .au-aside {
          display: flex; align-items: center; padding: 56px;
          background:
            radial-gradient(90% 60% at 100% 100%, rgba(90, 166, 245, 0.35) 0%, rgba(90, 166, 245, 0) 60%),
            linear-gradient(160deg, #0d3a6e 0%, #0a2540 100%);
          color: #fff;
        }
        .au-aside-inner { max-width: 480px; }
        .au-aside h2 { font-size: 34px; line-height: 1.2; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 32px; }
        .au-aside ul { list-style: none; margin: 0 0 32px; padding: 0; display: flex; flex-direction: column; gap: 20px; }
        .au-aside li { display: flex; gap: 14px; }
        .au-aside li > span { width: 42px; height: 42px; border-radius: 11px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.1); color: #7fb6f0; }
        .au-aside li b { font-size: 16px; }
        .au-aside li p { margin: 3px 0 0; font-size: 14px; color: #b9cde2; line-height: 1.5; }
        .au-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; border-radius: 14px; background: rgba(24, 119, 224, 0.25); border: 1px solid rgba(255, 255, 255, 0.12); }
        .au-card-logo { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #1877e0; font-weight: 800; font-size: 20px; flex-shrink: 0; }
        .au-card p { margin: 0; font-size: 14px; color: #e4eefa; }

        .au-btn:focus-visible, .au-tab:focus-visible, .au-eye:focus-visible, .au-choice:focus-visible { outline: 3px solid rgba(24, 119, 224, 0.35); outline-offset: 2px; }
        @media (max-width: 960px) {
          .au { grid-template-columns: 1fr; }
          .au-aside { display: none; }
          .au-panel { padding: 24px; }
        }
      `}</style>
    </main>
  );
}
