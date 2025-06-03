from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth import router as auth_router  # 👈 imports your auth router

app = FastAPI()

# ✅ Include auth routes
app.include_router(auth_router)

# ✅ Fix: properly closed CORS middleware config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)