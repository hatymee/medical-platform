-- =====================================================================
-- Plateforme Médicale — Schéma de base de données (MVP V1)
-- PostgreSQL 15+
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------
-- UTILISATEURS & AUTHENTIFICATION
-- ---------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('patient', 'doctor', 'clinic_admin', 'super_admin');

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            user_role NOT NULL,
    phone           VARCHAR(30),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- PATIENTS
-- ---------------------------------------------------------------------

-- Note : stocké en VARCHAR (pas un ENUM PostgreSQL strict) pour correspondre
-- exactement au modèle SQLAlchemy ; la validation des valeurs se fait côté API.

CREATE TABLE patients (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name          VARCHAR(100) NOT NULL,
    last_name           VARCHAR(100) NOT NULL,
    date_of_birth       DATE NOT NULL,
    sex                 VARCHAR(20),
    blood_group         VARCHAR(10) NOT NULL DEFAULT 'unknown',
    national_id         VARCHAR(50),
    address             TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_allergies (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    label       VARCHAR(255) NOT NULL,
    severity    VARCHAR(50),          -- ex: légère / modérée / sévère
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_chronic_conditions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id  UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    label       VARCHAR(255) NOT NULL,
    diagnosed_at DATE,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE patient_medications (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id   UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    dosage       VARCHAR(100),
    frequency    VARCHAR(100),
    start_date   DATE,
    end_date     DATE,
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- MÉDECINS & CLINIQUES
-- ---------------------------------------------------------------------

CREATE TABLE clinics (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(255) NOT NULL,
    address     TEXT,
    phone       VARCHAR(30),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE doctors (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    clinic_id       UUID REFERENCES clinics(id) ON DELETE SET NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    specialty       VARCHAR(150),
    license_number  VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ACCÈS AU DOSSIER (autorisation patient -> médecin)
-- ---------------------------------------------------------------------

CREATE TYPE access_status AS ENUM ('pending', 'approved', 'denied', 'expired', 'revoked');

CREATE TABLE record_access_grants (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    status          access_status NOT NULL DEFAULT 'pending',
    access_code     VARCHAR(20),          -- code temporaire affiché/saisi par le patient
    requested_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ,          -- accès limité dans le temps
    revoked_at      TIMESTAMPTZ
);

-- Journal d'accès : conforme aux exigences de sécurité / traçabilité
CREATE TABLE access_logs (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grant_id    UUID REFERENCES record_access_grants(id) ON DELETE SET NULL,
    doctor_id   UUID NOT NULL REFERENCES doctors(id),
    patient_id  UUID NOT NULL REFERENCES patients(id),
    action      VARCHAR(100) NOT NULL,   -- ex: 'viewed_record', 'downloaded_document'
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- DOCUMENTS MÉDICAUX
-- ---------------------------------------------------------------------

CREATE TYPE document_category AS ENUM (
    'prescription', 'lab_result', 'xray', 'mri', 'ct_scan',
    'ultrasound', 'operative_report', 'consultation_note', 'other'
);

CREATE TABLE medical_documents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    uploaded_by     UUID NOT NULL REFERENCES users(id),
    category        document_category NOT NULL,
    title           VARCHAR(255) NOT NULL,
    file_url        TEXT NOT NULL,        -- chemin vers le stockage cloud (S3 etc.)
    document_date   DATE NOT NULL,        -- date médicale du document (pas la date d'upload)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- CONSULTATIONS & PRESCRIPTIONS
-- ---------------------------------------------------------------------

CREATE TABLE consultations (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    consultation_date TIMESTAMPTZ NOT NULL DEFAULT now(),
    reason          TEXT,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prescriptions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID NOT NULL REFERENCES consultations(id) ON DELETE CASCADE,
    medication_name VARCHAR(255) NOT NULL,
    dosage          VARCHAR(100),
    duration        VARCHAR(100),
    instructions    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- RENDEZ-VOUS
-- ---------------------------------------------------------------------

CREATE TYPE appointment_status AS ENUM ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show');

CREATE TABLE appointments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id      UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    doctor_id       UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    scheduled_at    TIMESTAMPTZ NOT NULL,
    status          appointment_status NOT NULL DEFAULT 'scheduled',
    reason          TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- INDEX UTILES
-- ---------------------------------------------------------------------

CREATE INDEX idx_documents_patient ON medical_documents(patient_id, category);
CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, scheduled_at);
CREATE INDEX idx_appointments_patient_date ON appointments(patient_id, scheduled_at);
CREATE INDEX idx_access_grants_patient ON record_access_grants(patient_id, status);
CREATE INDEX idx_access_grants_doctor ON record_access_grants(doctor_id, status);
CREATE INDEX idx_consultations_patient ON consultations(patient_id, consultation_date);
