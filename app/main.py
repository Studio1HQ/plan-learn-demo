import os
from contextlib import asynccontextmanager
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.infra.rate_limit import limiter
from app.api.chat import router as chat_router
from app.api.tasks import router as tasks_router
from app.api.insights import router as insights_router
from app.api.alerts import router as alerts_router
from app.api.usage import router as usage_router
from app.api.sample_data import router as sample_data_router
from app.api.memori_state import router as memori_state_router
from app.db.session import db_session_factory
from app.db.init import init_database
from memori import Memori

load_dotenv()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize application tables (usage_event, alert_event)
    init_database()
    # Initialize Memori tables (memori_*)
    Memori(conn=db_session_factory).config.storage.build()
    yield

app = FastAPI(lifespan=lifespan)

# CORS origins - add FRONTEND_URL env var for production
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.getenv("FRONTEND_URL"):
    cors_origins.append(os.getenv("FRONTEND_URL"))
# Allow all Vercel preview deployments
cors_origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.limiter = limiter
app.add_exception_handler(
    RateLimitExceeded, _rate_limit_exceeded_handler
)

app.include_router(chat_router, prefix="/api")
app.include_router(tasks_router, prefix="/api")
app.include_router(insights_router, prefix="/api")
app.include_router(alerts_router, prefix="/api")
app.include_router(usage_router, prefix="/api")
app.include_router(sample_data_router, prefix="/api")
app.include_router(memori_state_router, prefix="/api")