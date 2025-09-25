import os

class Config:
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:Arth1827@localhost:5432/workscheduler"
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    JSON_SORT_KEYS = False

class DevConfig(Config):
    DEBUG = True

class ProdConfig(Config):
    DEBUG = False
