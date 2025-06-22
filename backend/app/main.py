from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="PDF to Excel Extractor API",
    description="Secure local PDF extraction service",
    version="0.1.0",
)

# Configure CORS for Electron frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:*", "file://*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "PDF to Excel Extractor API", "status": "healthy"}


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "pdf-excel-extractor",
        "version": "0.1.0",
    }