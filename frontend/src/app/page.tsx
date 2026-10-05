import Link from "next/link";
import {
  CalendarDays, FolderOpen, Pill, ShieldCheck, Stethoscope, Users, Building2, ArrowRight, CheckCircle2,
} from "lucide-react";

const MODULES = [
  { icon: FolderOpen, title: "Dossier médical", text: "Documents, examens et historique patient réunis en un seul lieu, accessibles à tout moment." },
  { icon: CalendarDays, title: "Rendez-vous", text: "Prise de rendez-vous en ligne, rappels et planning partagé avec le secrétariat." },
  { icon: Pill, title: "Ordonnances", text: "Prescriptions et recommandations disponibles dès la fin de la consultation." },
];

const SPACES = [
  { icon: Users, title: "Patients", text: "Dossier médical, rendez-vous et documents toujours à portée de main." },
  { icon: Stethoscope, title: "Médecins", text: "Consultations, ordonnances et suivi financier dans un même espace." },
  { icon: Building2, title: "Cabinets", text: "Gestion du secrétariat, des équipes et de la facturation au quotidien." },
];

const POINTS = [
  "Accès sécurisé et traçable, propre à chaque rôle",
  "Dossier médical centralisé pour chaque patient",
  "Prise de rendez-vous en ligne, suivie par le secrétariat",
];

export default function Home() {
  return (
    <main className="hm">
      <header className="hm-nav">
        <div className="hm-inner hm-nav-row">
          <a className="hm-brand" href="#accueil">
            <span className="hm-logo">+</span>
            <span>
              <span className="hm-brand-name">Med<em>Link</em></span>
              <span className="hm-brand-tag">Votre santé, notre priorité</span>
            </span>
          </a>
          <nav className="hm-nav-links">
            <a href="#modules">Plateforme</a>
            <a href="#espaces">Espaces</a>
            <Link href="/connexion">Connexion</Link>
            <Link className="hm-btn hm-btn-sm" href="/inscription">Créer un compte</Link>
          </nav>
        </div>
      </header>

      <section id="accueil" className="hm-hero">
        <div className="hm-inner hm-hero-grid">
          <div className="hm-hero-text">
            <p className="hm-eyebrow">Plateforme médicale sécurisée</p>
            <h1>Votre santé, connectée en toute sécurité.</h1>
            <p className="hm-lead">
              Un accès moderne pour les patients, médecins et cabinets : dossier médical, rendez-vous,
              documents et prescriptions réunis au même endroit.
            </p>
            <div className="hm-hero-actions">
              <Link className="hm-btn" href="/inscription">Commencer <ArrowRight size={17} /></Link>
              <a className="hm-discover" href="#modules">Découvrir la plateforme →</a>
            </div>
            <ul className="hm-points">
              {POINTS.map((p) => (
                <li key={p}><CheckCircle2 size={17} /> {p}</li>
              ))}
            </ul>
          </div>

          <aside className="hm-card">
            <p className="hm-card-eyebrow">Espace patient</p>
            <h2>Tout votre suivi médical</h2>
            <p>Accédez à vos informations médicales et partagez-les uniquement avec les professionnels que vous autorisez.</p>
            <div className="hm-card-row"><ShieldCheck size={18} /> Accès sécurisé et traçable</div>
            <div className="hm-card-row"><CalendarDays size={18} /> Prochain rendez-vous toujours visible</div>
            <div className="hm-card-row"><FolderOpen size={18} /> Documents centralisés</div>
          </aside>
        </div>
      </section>

      <section id="modules" className="hm-section">
        <div className="hm-inner">
          <p className="hm-eyebrow hm-center">La plateforme</p>
          <h2 className="hm-h2 hm-center">Tout ce qu'il faut pour un suivi médical simple</h2>
          <div className="hm-cards">
            {MODULES.map((m) => (
              <article className="hm-mcard" key={m.title}>
                <span className="hm-mcard-ic"><m.icon size={24} /></span>
                <h3>{m.title}</h3>
                <p>{m.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="espaces" className="hm-section hm-section-alt">
        <div className="hm-inner">
          <p className="hm-eyebrow hm-center">Pour chacun</p>
          <h2 className="hm-h2 hm-center">Un espace pensé pour chaque rôle</h2>
          <div className="hm-cards hm-cards-3">
            {SPACES.map((s) => (
              <article className="hm-mcard" key={s.title}>
                <span className="hm-mcard-ic hm-mcard-ic-alt"><s.icon size={24} /></span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="hm-cta">
        <div className="hm-inner hm-cta-inner">
          <div>
            <h2>Prêt à rejoindre MedLink ?</h2>
            <p>Créez votre compte patient en quelques instants.</p>
          </div>
          <Link className="hm-btn hm-btn-light" href="/inscription">Créer un compte <ArrowRight size={17} /></Link>
        </div>
      </section>

      <footer className="hm-foot">
        <div className="hm-inner hm-foot-row">
          <span className="hm-brand">
            <span className="hm-logo hm-logo-sm">+</span>
            <span className="hm-brand-name">Med<em>Link</em></span>
          </span>
          <nav className="hm-foot-links">
            <Link href="/connexion">Connexion</Link>
            <Link href="/inscription">Créer un compte</Link>
          </nav>
        </div>
      </footer>

      <style>{`
        .hm { color: #0a2540; background: #fff; }
        .hm-inner { max-width: 1160px; margin: 0 auto; padding: 0 32px; }

        .hm-nav { position: sticky; top: 0; z-index: 50; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(8px); border-bottom: 1px solid #e1eaf3; }
        .hm-nav-row { display: flex; align-items: center; justify-content: space-between; padding: 14px 32px; }
        .hm-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #0a2540; }
        .hm-logo { width: 38px; height: 38px; border-radius: 11px; display: flex; align-items: center; justify-content: center; background: #1877e0; color: #fff; font-size: 24px; font-weight: 800; box-shadow: 0 6px 16px rgba(24, 119, 224, 0.3); }
        .hm-logo-sm { width: 32px; height: 32px; font-size: 20px; }
        .hm-brand-name { display: block; font-size: 20px; font-weight: 800; letter-spacing: -0.02em; }
        .hm-brand-name em { font-style: normal; color: #1877e0; }
        .hm-brand-tag { display: block; font-size: 11px; color: #5a7590; }
        .hm-nav-links { display: flex; align-items: center; gap: 26px; font-size: 14px; font-weight: 500; }
        .hm-nav-links a { color: #34506d; text-decoration: none; }
        .hm-nav-links a:hover { color: #1877e0; }

        .hm-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 22px; border-radius: 10px; background: #1877e0; color: #fff; font-size: 15px; font-weight: 700; text-decoration: none; box-shadow: 0 8px 20px rgba(24, 119, 224, 0.28); }
        .hm-btn:hover { background: #0f5cbf; }
        .hm-btn-sm { padding: 9px 16px; font-size: 13px; box-shadow: none; }
        .hm-btn-light { background: #fff; color: #1877e0; }
        .hm-btn-light:hover { background: #eaf3fd; }

        .hm-hero { padding: 72px 0 88px; background: radial-gradient(80% 60% at 85% 0%, rgba(24, 119, 224, 0.08) 0%, rgba(24, 119, 224, 0) 60%); }
        .hm-hero-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 56px; align-items: center; }
        .hm-eyebrow { font-size: 13px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #1877e0; margin: 0 0 14px; }
        .hm-hero-text h1 { font-size: 46px; line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 20px; }
        .hm-lead { font-size: 17px; line-height: 1.65; color: #34506d; margin: 0 0 30px; max-width: 54ch; }
        .hm-hero-actions { display: flex; align-items: center; gap: 22px; margin-bottom: 34px; flex-wrap: wrap; }
        .hm-discover { font-size: 14px; font-weight: 600; color: #1877e0; text-decoration: none; }
        .hm-discover:hover { text-decoration: underline; }
        .hm-points { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 11px; }
        .hm-points li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #34506d; }
        .hm-points svg { color: #1a9a5c; flex-shrink: 0; }

        .hm-card { background: #fff; border: 1px solid #e1eaf3; border-radius: 20px; padding: 30px; box-shadow: 0 24px 60px rgba(10, 37, 64, 0.1); }
        .hm-card-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #1877e0; margin: 0 0 10px; }
        .hm-card h2 { font-size: 22px; font-weight: 800; margin: 0 0 10px; letter-spacing: -0.02em; }
        .hm-card > p { font-size: 14px; line-height: 1.6; color: #5a7590; margin: 0 0 20px; }
        .hm-card-row { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid #eef2f6; font-size: 14px; font-weight: 500; }
        .hm-card-row:first-of-type { border-top: none; }
        .hm-card-row svg { color: #1877e0; flex-shrink: 0; }

        .hm-section { padding: 76px 0; }
        .hm-section-alt { background: #f6fafd; }
        .hm-center { text-align: center; }
        .hm-h2 { font-size: 30px; font-weight: 800; letter-spacing: -0.02em; margin: 0 auto 44px; max-width: 46ch; }

        .hm-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
        .hm-mcard { padding: 28px; border: 1px solid #e1eaf3; border-radius: 16px; background: #fff; }
        .hm-mcard-ic { width: 50px; height: 50px; border-radius: 13px; display: flex; align-items: center; justify-content: center; background: #eaf3fd; color: #1877e0; margin-bottom: 18px; }
        .hm-mcard-ic-alt { background: #fff; border: 1px solid #e1eaf3; }
        .hm-mcard h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px; }
        .hm-mcard p { font-size: 14px; line-height: 1.6; color: #5a7590; margin: 0; }

        .hm-cta { padding: 56px 0; background: linear-gradient(135deg, #0d3a6e 0%, #0a2540 100%); color: #fff; }
        .hm-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
        .hm-cta h2 { font-size: 26px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.02em; }
        .hm-cta p { margin: 0; color: #c9def5; font-size: 15px; }

        .hm-foot { padding: 28px 0; border-top: 1px solid #e1eaf3; }
        .hm-foot-row { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; }
        .hm-foot .hm-brand-name { font-size: 16px; }
        .hm-foot-links { display: flex; gap: 22px; font-size: 14px; }
        .hm-foot-links a { color: #5a7590; text-decoration: none; }
        .hm-foot-links a:hover { color: #1877e0; }

        @media (max-width: 960px) {
          .hm-hero-grid { grid-template-columns: 1fr; }
          .hm-hero-text h1 { font-size: 34px; }
          .hm-cards, .hm-cards-3 { grid-template-columns: 1fr; }
          .hm-nav-links { gap: 14px; font-size: 13px; }
          .hm-inner { padding: 0 20px; }
        }
      `}</style>
    </main>
  );
}
