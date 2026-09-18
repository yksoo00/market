from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    internal_token: str  # spring과 같은 값. 루트 .env.example 참고
    llm_api_key: str = ""
    ocr_api_key: str = ""
    embedding_model: str = ""


settings = Settings()  # type: ignore[call-arg]
