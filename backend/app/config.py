from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "CRM Agency API"
    debug: bool = False
    secret_key: str

    # Database
    database_url: str

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # JWT
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 8  # 8 hours

    # WhatsApp (Green API)
    green_api_instance: str = ""
    green_api_token: str = ""

    # MAX (Mail.ru)
    max_bot_token: str = ""

    # Email
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""

    # Google Sheets sync
    google_credentials_file: str = ""          # path to service-account JSON
    google_sheets_spreadsheet_id: str = ""     # spreadsheet ID from URL
    sheets_sync_interval_seconds: int = 30     # how often to poll (default 30 sec)

    # Robokassa
    robokassa_merchant_login: str = ""
    robokassa_pass1: str = ""
    robokassa_pass2: str = ""
    robokassa_test_mode: bool = True
    robokassa_base_url: str = "https://auth.robokassa.ru/Merchant/Index.aspx"


settings = Settings()
