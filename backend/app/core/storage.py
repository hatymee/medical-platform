import uuid
from supabase import create_client

from app.core.config import settings

_client = None


def _get_client():
    global _client
    if _client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_KEY:
            raise RuntimeError("Stockage non configure : SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant")
        _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_KEY)
    return _client


def upload_file(patient_id: str, filename: str, contents: bytes, content_type: str) -> str:
    """Stocke le fichier et renvoie son chemin dans le bucket."""
    path = f"{patient_id}/{uuid.uuid4().hex}_{filename}"
    _get_client().storage.from_(settings.SUPABASE_BUCKET).upload(
        path,
        contents,
        {"content-type": content_type},
    )
    return path


def signed_url(path: str, expires_in: int = 3600) -> str:
    """Lien temporaire pour consulter un document."""
    res = _get_client().storage.from_(settings.SUPABASE_BUCKET).create_signed_url(path, expires_in)
    return res.get("signedURL") or res.get("signedUrl", "")