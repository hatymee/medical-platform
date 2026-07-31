const modules = [
  ["Dossier médical", "Documents, examens et historique patient réunis en un seul lieu."],
  ["Rendez-vous", "Consultations, rappels et planning des professionnels de santé."],
  ["Ordonnances", "Prescriptions et recommandations disponibles après la consultation."],
];

export default function Home() {
  return (
    <main>
      <nav>
        <a className="brand" href="#accueil">MedLink</a>
        <div className="nav-links"><a href="/connexion">Connexion</a><a className="button compact" href="/inscription">Créer un compte</a></div>
      </nav>
      <section id="accueil" className="hero">
        <div>
          <p className="eyebrow">PLATEFORME MÉDICALE SÉCURISÉE</p>
          <h1>Votre santé, connectée en toute sécurité.</h1>
          <p className="lead">Un accès moderne pour les patients, médecins et cliniques : dossier médical, rendez-vous, documents et prescriptions.</p>
          <div className="actions"><a className="button" href="/inscription">Commencer</a><a className="discover" href="#modules">Découvrir la plateforme →</a></div>
        </div>
        <aside>
          <p className="eyebrow">ESPACE PATIENT</p>
          <h2>Tout votre suivi médical</h2>
          <p>Accédez à vos informations médicales et partagez-les uniquement avec les professionnels autorisés.</p>
          <span>● Accès sécurisé et traçable</span>
        </aside>
      </section>
      <section id="modules" className="cards">
        {modules.map(([title, text]) => <article key={title}><div className="symbol">+</div><h2>{title}</h2><p>{text}</p></article>)}
      </section>
    </main>
  );
}
