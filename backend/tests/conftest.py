import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app

# Utilise une base Postgres séparée pour les tests, jamais la base de dev.
# Par défaut : même serveur que DATABASE_URL, avec un nom de base suffixé "_test".
TEST_DATABASE_URL = settings.DATABASE_URL.rsplit("/", 1)[0] + "/medical_platform_test"

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def setup_test_database():
    """Crée toutes les tables une fois pour la session de tests, les supprime à la fin."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db_session():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db_session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def unique_email():
    """Génère un email unique par test pour éviter les conflits entre tests."""
    def _make(prefix: str) -> str:
        return f"{prefix}-{uuid.uuid4().hex[:8]}@test.com"
    return _make


@pytest.fixture()
def registered_patient(client, unique_email):
    email = unique_email("patient")
    payload = {
        "email": email,
        "password": "testpass123",
        "first_name": "Test",
        "last_name": "Patient",
        "date_of_birth": "1990-01-01",
        "sex": "F",
        "blood_group": "O+",
    }
    resp = client.post("/api/v1/auth/register/patient", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return {"email": email, "token": data["access_token"]}


@pytest.fixture()
def registered_doctor(client, unique_email):
    email = unique_email("doctor")
    payload = {
        "email": email,
        "password": "testpass123",
        "first_name": "Test",
        "last_name": "Doctor",
        "specialty": "Généraliste",
        "license_number": "LIC-TEST",
    }
    resp = client.post("/api/v1/auth/register/doctor", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    return {"email": email, "token": data["access_token"]}


def auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
