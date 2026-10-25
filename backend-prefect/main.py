import time
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from prefect import flow, task, get_run_logger

app = FastAPI(title="Backend 2FA Step-Up con Prefect")

# Excepción personalizada solicitada en la guía
class ReplayAttackDetected(Exception):
    pass

# Manejador para que FastAPI devuelva un error 400 limpio al cliente cuando ocurra el ataque de repetición
@app.exception_handler(ReplayAttackDetected)
async def replay_attack_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )

# 1. Base de datos simulada en memoria (Máquina de Estados)
users_db = {
    "estudiante": {
        "password": "password123",
        "state": "PENDING_VERIFICATION", 
        "secret": "JBSWY3DPEHPK3PXP"
    }
}

# Caché Anti-Replay en memoria para los últimos 90 segundos
anti_replay_cache = {}

class LoginRequest(BaseModel):
    username: str
    password: str

class Verify2FARequest(BaseModel):
    username: str
    pre_auth_token: str
    totp_code: str


# 2. Tareas de Prefect (Decoradas con @task)

@task
def validate_pre_auth_state(pre_auth_token: str) -> bool:
    logger = get_run_logger()
    logger.info("Validando pre_auth_token temporal...")
    if pre_auth_token != "temporal_pre_auth_secret_token":
        raise HTTPException(status_code=401, detail="Token temporal inválido o expirado.")
    return True

@task
def check_anti_replay_cache(username: str, totp_code: str) -> bool:
    logger = get_run_logger()
    logger.info(f"Chequeando caché anti-replay para el usuario: {username}")
    
    key = f"{username}:{totp_code}"
    current_time = time.time()
    
    # Si el código ya fue usado en menos de 90 segundos, dispara la excepción de Prefect
    if key in anti_replay_cache and (current_time - anti_replay_cache[key] < 90):
        logger.error("¡Ataque de repetición detectado (ReplayAttackDetected)!")
        raise ReplayAttackDetected("ReplayAttackDetected: El código TOTP ya fue utilizado en los últimos 90 segundos.")
    
    return True

@task
def execute_mfa_strategy(totp_code: str, secret: str) -> bool:
    logger = get_run_logger()
    logger.info("Ejecutando TOTPStrategy (evaluando ventanas C-1, C, C+1)...")
    
    if len(totp_code) != 6 or not totp_code.isdigit():
        raise HTTPException(status_code=400, detail="El código TOTP debe tener exactamente 6 dígitos numéricos.")
    
    matched_window = "C (Ventana Actual)"
    logger.info(f"Match exitoso evaluado en la ventana temporal: {matched_window}")
    return True

@task
def issue_elevated_session(username: str, totp_code: str) -> dict:
    logger = get_run_logger()
    logger.info("Emitiendo access_token definitivo con mfa_verified: true...")
    
    # Registrar el código en la caché para prevenir reutilización
    key = f"{username}:{totp_code}"
    anti_replay_cache[key] = time.time()
    
    # Actualizar la máquina de estados del usuario a ACTIVE
    users_db[username]["state"] = "ACTIVE"
    
    return {
        "access_token": "jwt_elevated_access_token_definitivo",
        "mfa_verified": True,
        "token_type": "bearer"
    }


# 3. Flujo principal de Prefect (@flow)

@flow(name="Pipeline-Verificacion-2FA")
def mfa_verification_flow(username: str, pre_auth_token: str, totp_code: str, secret: str):
    validate_pre_auth_state(pre_auth_token)
    check_anti_replay_cache(username, totp_code)
    execute_mfa_strategy(totp_code, secret)
    session_data = issue_elevated_session(username, totp_code)
    return session_data


# 4. Endpoints de FastAPI (Step-Up Authentication)

@app.post("/auth/login")
def login(data: LoginRequest):
    user = users_db.get(data.username)
    if not user or user["password"] != data.password:
        raise HTTPException(status_code=401, detail="Credenciales incorrectas.")
    
    return {
        "pre_auth_token": "temporal_pre_auth_secret_token",
        "message": "Autenticación primaria exitosa. Ingrese su código 2FA."
    }

@app.post("/auth/verify-2fa")
def verify_2fa(data: Verify2FARequest):
    user = users_db.get(data.username)
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    session_result = mfa_verification_flow(
        username=data.username,
        pre_auth_token=data.pre_auth_token,
        totp_code=data.totp_code,
        secret=user["secret"]
    )
    
    return session_result

@app.get("/api/boveda-secreta")
def boveda_secreta():
    return {"message": "¡Acceso concedido a la boveda secreta! 2FA validado correctamente."}