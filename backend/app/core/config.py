from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """
    Configuration centrale de l'application.
    Toutes ces valeurs sont surchargeables via un fichier .env
    """

    PROJECT_NAME: str = "Plateforme Médicale"
    API_V1_PREFIX: str = "/api/v1"

    # Base de données
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/medical_platform"

    # Sécurité / JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24h

    # Stockage fichiers (S3 ou compatible)
    STORAGE_BUCKET: str = "medical-platform-documents"
    STORAGE_ENDPOINT_URL: str | None = None

    # Durée par défaut d'un accès dossier accordé à un médecin
    RECORD_ACCESS_DEFAULT_HOURS: int = 24

    class Config:
        env_file = ".env"


settings = Settings()
