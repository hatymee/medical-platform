"""
Tests du flux d'accès au dossier patient — la partie la plus sensible du MVP.
Couvre : demande d'accès, refus d'accès sans autorisation, approbation,
consultation autorisée, et le cas d'un accès jamais approuvé.
"""
from tests.conftest import auth_headers


def test_doctor_cannot_view_documents_without_access(client, registered_patient, registered_doctor):
    """Un médecin sans accès approuvé ne doit JAMAIS voir les documents d'un patient."""
    patient_me = client.get("/api/v1/patients/me", headers=auth_headers(registered_patient["token"]))
    assert patient_me.status_code == 200
    patient_id = patient_me.json()["id"]

    resp = client.get(
        f"/api/v1/documents/patient/{patient_id}",
        headers=auth_headers(registered_doctor["token"]),
    )
    assert resp.status_code == 403


def test_full_access_grant_flow(client, registered_patient, registered_doctor):
    """Flux complet : demande -> pending -> approbation -> accès autorisé."""
    # 1. Le médecin demande l'accès
    resp = client.post(
        "/api/v1/access/request",
        json={"patient_email": registered_patient["email"]},
        headers=auth_headers(registered_doctor["token"]),
    )
    assert resp.status_code == 200, resp.text
    grant = resp.json()
    assert grant["status"] == "pending"
    grant_id = grant["id"]

    # 2. Le patient voit la demande en attente
    resp = client.get("/api/v1/access/my-requests", headers=auth_headers(registered_patient["token"]))
    assert resp.status_code == 200
    pending_ids = [g["id"] for g in resp.json()]
    assert grant_id in pending_ids

    # 3. Le patient approuve
    resp = client.post(
        "/api/v1/access/respond",
        json={"grant_id": grant_id, "approve": True},
        headers=auth_headers(registered_patient["token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "approved"

    # 4. Le médecin peut maintenant consulter les documents (liste vide, mais 200 pas 403)
    patient_id = grant["patient_id"]
    resp = client.get(
        f"/api/v1/documents/patient/{patient_id}",
        headers=auth_headers(registered_doctor["token"]),
    )
    assert resp.status_code == 200
    assert resp.json() == []


def test_patient_can_deny_access_request(client, registered_patient, registered_doctor):
    """Un refus doit laisser le médecin sans accès."""
    resp = client.post(
        "/api/v1/access/request",
        json={"patient_email": registered_patient["email"]},
        headers=auth_headers(registered_doctor["token"]),
    )
    grant_id = resp.json()["id"]
    patient_id = resp.json()["patient_id"]

    resp = client.post(
        "/api/v1/access/respond",
        json={"grant_id": grant_id, "approve": False},
        headers=auth_headers(registered_patient["token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "denied"

    resp = client.get(
        f"/api/v1/documents/patient/{patient_id}",
        headers=auth_headers(registered_doctor["token"]),
    )
    assert resp.status_code == 403


def test_another_patient_cannot_respond_to_someone_elses_grant(client, registered_patient, registered_doctor, unique_email):
    """Un patient ne doit pas pouvoir approuver une demande qui ne le concerne pas."""
    resp = client.post(
        "/api/v1/access/request",
        json={"patient_email": registered_patient["email"]},
        headers=auth_headers(registered_doctor["token"]),
    )
    grant_id = resp.json()["id"]

    # Un second patient tente de répondre à la demande du premier
    other_email = unique_email("other-patient")
    client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": other_email,
            "password": "testpass123",
            "first_name": "Autre",
            "last_name": "Patient",
            "date_of_birth": "1985-05-05",
        },
    )
    login_resp = client.post(
        "/api/v1/auth/login", json={"email": other_email, "password": "testpass123"}
    )
    other_token = login_resp.json()["access_token"]

    resp = client.post(
        "/api/v1/access/respond",
        json={"grant_id": grant_id, "approve": True},
        headers=auth_headers(other_token),
    )
    assert resp.status_code == 404


def test_login_with_wrong_password_fails(client, registered_patient):
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": registered_patient["email"], "password": "wrong-password"},
    )
    assert resp.status_code == 401


def test_cannot_register_duplicate_email(client, registered_patient):
    resp = client.post(
        "/api/v1/auth/register/patient",
        json={
            "email": registered_patient["email"],
            "password": "testpass123",
            "first_name": "Doublon",
            "last_name": "Test",
            "date_of_birth": "1990-01-01",
        },
    )
    assert resp.status_code == 400
