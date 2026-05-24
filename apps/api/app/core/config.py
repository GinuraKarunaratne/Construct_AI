from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "ConstructAI"
    API_VERSION: str = "v1"

    DATABASE_URL: str = "postgresql+psycopg://constructai:constructai_dev@localhost:5432/constructai"

    JWT_SECRET_KEY: str = "change-this-secret"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8081"]

    WEATHER_API_KEY: str = ""


settings = Settings()
