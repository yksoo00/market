from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.config import settings

app = FastAPI(title="market ai", docs_url=None, redoc_url=None)  # 내부 전용. swagger 노출 안 함


@app.middleware("http")
async def require_internal_token(request: Request, call_next):  # type: ignore[no-untyped-def]
    if request.url.path != "/health":  # /health 는 compose 헬스체크가 토큰 없이 호출
        token = request.headers.get("X-Internal-Token")
        if token != settings.internal_token:
            body = {"ok": False, "code": "UNAUTHORIZED", "message": "internal token"}
            return JSONResponse(body, 401)
    return await call_next(request)


@app.get("/health")
async def health() -> dict[str, object]:
    return {"ok": True, "model_loaded": False, "llm_reachable": False}
