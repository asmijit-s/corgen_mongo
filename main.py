# main.py
from fastapi import FastAPI
from api import router as course_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="AI Course Generator")

# Include API router (with optional prefix and tags)
app.include_router(course_router, prefix="/course", tags=["Course Generation"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Or ["http://localhost:3000"] for React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check or root endpoint
@app.get("/", tags=["Health"])
def read_root():
    return {"message": "AI Course Generator backend is running"}

