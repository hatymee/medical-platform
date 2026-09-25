import { User, ChevronRight, Info } from "lucide-react";
import AuthLayout from "@/components/AuthLayout";

export default function InscriptionPage() {
  return (
    <AuthLayout headline="Chaque rôle possède uniquement les accès nécessaires.">
      <h1>Créer un accès</h1>
      <p className="au-lead">
        Créez votre compte pour consulter votre dossier, vos rendez-vous et vos documents.
        Les informations administratives sont complétées par le secrétariat médical.
      </p>

      <a className="au-choice" href="/inscription-patient">
        <span className="au-choice-ic"><User size={22} /></span>
        <span>
          <b>Créer mon compte patient</b>
          <p>Consulter mon dossier, mes rendez-vous et mes documents.</p>
        </span>
        <ChevronRight size={20} />
      </a>

      <div className="au-note">
        <Info size={16} />
        <span>Vous êtes médecin ou secrétaire ? Votre compte est créé par l&apos;administrateur de votre cabinet.</span>
      </div>

      <p className="au-hint">Vous avez déjà un compte ? <a href="/connexion">Se connecter</a></p>
    </AuthLayout>
  );
}
