import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

from app.routes import router

APP_NAME = os.getenv("APP_NAME", "training-rails")

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
allow_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", DEFAULT_ORIGINS).split(",")
    if o.strip()
]

# Vercel preview deploys get a unique hash subdomain on every push
# (e.g. training-rails-<hash>-ksavkins-projects.vercel.app), so a static
# allowlist breaks on the next deploy. CORS_ORIGIN_REGEX lets you match
# the whole project surface — set it on Render to e.g.
#   ^https://training-rails(-[a-z0-9]+)?-ksavkins-projects\.vercel\.app$
allow_origin_regex = os.getenv("CORS_ORIGIN_REGEX") or None

app = FastAPI(title=APP_NAME)
app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_origin_regex=allow_origin_regex,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
