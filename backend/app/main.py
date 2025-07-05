from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.auth import router as auth_router  # 👈 Import your router

app = FastAPI()

# ✅ Enable CORS for frontend (React on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)  # 👈 this closing parenthesis was missing

# ✅ Register your routes
app.include_router(auth_router)