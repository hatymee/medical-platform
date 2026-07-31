# Plateforme Médicale — MVP V1

Dossier médical patient unifié + gestion de cabinet (rendez-vous, accès sécurisé, documents).

## Architecture (V1)

```
[ Frontend Next.js ]  ---HTTPS/JWT--->  [ FastAPI backend ]  --->  [ PostgreSQL ]
                                               |
                                               ---> [ Stockage fichiers (S3 / local en dev) ]
```

- **Backend** : FastAPI (Python), SQLAlchemy 2.0, PostgreSQL, JWT (python-jose), bcrypt (passlib)
- **Frontend** : Next.js (à créer — V1 web only, mobile Flutter/React Native en V3)
- **Stockage documents** : chemin `local://` en dev, migration vers S3-compatible en V2
- **Auth** : JWT porteur de `sub` (user_id) et `role` (patient/doctor/clinic_admin/super_admin)

## Structure du repo

```
medical-platform/
├── backend/
│   ├── app/
│   │   ├── core/         # config, DB, sécurité (JWT/hash), dépendances FastAPI
│   │   ├── models/        # modèles SQLAlchemy
│   │   ├── schemas/        # schémas Pydantic (requêtes/réponses)
│   │   ├── routers/        # endpoints : auth, access, documents, appointments
│   │   └── main.py
│   ├── requirements.txt
│   └── .env.example
├── database/
│   └── schema.sql          # schéma PostgreSQL complet (source de vérité du MVP)
└── docs/
```

## Lancer le backend en local

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # puis ajuster DATABASE_URL / SECRET_KEY

# Créer la base et charger le schéma
createdb medical_platform
psql medical_platform -f ../database/schema.sql

uvicorn app.main:app --reload
```

L'API est ensuite disponible sur `http://localhost:8000`, doc interactive sur `/docs`.

## Flux clé : accès sécurisé au dossier patient

1. `POST /api/v1/access/request` (médecin, authentifié) → crée une demande `pending` + code à 6 chiffres
2. Le patient consulte `GET /api/v1/access/my-requests` et approuve via `POST /api/v1/access/respond`
3. Une fois `approved`, le médecin peut lister les documents via `GET /api/v1/documents/patient/{id}`
   — chaque consultation est tracée dans `access_logs` (traçabilité RGPD/HIPAA)
4. L'accès expire automatiquement après `RECORD_ACCESS_DEFAULT_HOURS` (24h par défaut)

Le QR code / NFC prévus dans le prompt d'origine viendront se brancher sur ce même mécanisme
en V2 : ils ne font que générer/scanner le `access_code` au lieu de le saisir manuellement.

## Ce qui n'est PAS encore dans ce squelette (volontairement, pour rester MVP)

- Facturation, assurances, paiements
- Notifications SMS/WhatsApp/push (uniquement des `TODO` marqués dans le code)
- IA (résumé de dossier, analyse d'examens)
- App mobile

## Migrations (Alembic)

Le schéma est piloté par `database/schema.sql` pour la base de dev existante.
Alembic est configuré pour prendre le relais à partir de maintenant :

```bash
cd backend
# Marque ta base existante comme étant déjà à jour (ne crée rien, ne modifie rien)
alembic stamp head

# Pour toute future modification du schéma :
# 1. Modifier app/models/models.py
# 2. Générer la migration automatiquement :
alembic revision --autogenerate -m "description du changement"
# 3. Relire le fichier généré dans alembic/versions/ (l'autogénération n'est pas parfaite)
# 4. Appliquer :
alembic upgrade head
```

## Tests (pytest)

Les tests couvrent le flux d'accès au dossier — la partie la plus sensible du MVP
(demande, approbation, refus, isolation entre patients, doublons d'email).

Ils tournent sur une base Postgres **séparée** (`medical_platform_test`), jamais sur
la base de dev, pour ne pas polluer tes données de test manuel.

```bash
# Créer la base de test une seule fois
createdb medical_platform_test
# (ou : psql -U postgres -c "CREATE DATABASE medical_platform_test;")

cd backend
pytest -v
```

Les tables sont créées/supprimées automatiquement par la fixture `setup_test_database`
à chaque session de tests — pas besoin de charger `schema.sql` dedans.

## Nouveaux endpoints (Phase 1)

- `GET/PATCH /api/v1/patients/me` — profil du patient connecté
- `GET/PATCH /api/v1/doctors/me` — profil du médecin connecté
- `POST /api/v1/clinics` — créer une clinique
- `GET /api/v1/clinics/{id}` — détails d'une clinique
- `GET /api/v1/clinics/{id}/doctors` — médecins rattachés à une clinique

## Prochaines étapes suggérées

1. Brancher un vrai stockage S3-compatible pour `documents.py`
2. Système d'invitation pour rattacher un médecin à une clinique existante
3. Notifications (V2) sur les demandes d'accès et rendez-vous
4. Tests sur les endpoints `documents` et `appointments`
