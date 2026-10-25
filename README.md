# Taller 2FA: Step-Up Authentication con FastAPI, Prefect y Expo

Este repositorio contiene la solución completa para el laboratorio de **Step-Up Authentication (Autenticación de Doble Factor por Pasos)**, implementando un pipeline de orquestación de flujos con **Prefect**, un backend robusto en **FastAPI**, y una aplicación móvil desarrollada en **Expo / React Native**.

---

## 🏗️ Arquitectura del Proyecto

El sistema está dividido en dos componentes principales:

1. **`backend-prefect/` (Backend & Orquestación):**
   * **FastAPI:** Expone los endpoints de autenticación primaria (`/auth/login`), verificación de segundo factor (`/auth/verify-2fa`) y la ruta protegida de la boveda secreta (`/api/boveda-secreta`).
   * **Prefect Workflow (`Pipeline-Verificacion-2FA`):** Orquestador que ejecuta de forma secuencial cuatro tareas críticas:
     1. `validate_pre_auth_state`: Valida la vigencia del token temporal de primer factor.
     2. `check_anti_replay_cache`: Verifica que el código TOTP no haya sido reutilizado en los últimos 90 segundos (lanza una excepción controlada `ReplayAttackDetected` en caso de reuso).
     3. `execute_mfa_strategy`: Evalúa criptográficamente las ventanas temporales permitidas ($C-1$, $C$, $C+1$) registrando el match mediante `get_run_logger()`.
     4. `issue_elevated_session`: Registra el código en caché e emite el token JWT definitivo con el nivel de acceso elevado (`mfa_verified: true`).

2. **`mobile-authenticator/` (Aplicación Móvil):**
   * Desarrollada con **Expo**, actúa como el tokenizador TOTP del usuario, generando códigos numéricos de 6 dígitos síncronos basados en el estándar criptográfico (RFC 6238) a partir de una semilla secreta compartida en Base32.

---

## 🚀 Guía de Ejecución

Sigue estos pasos en orden para levantar todo el entorno de desarrollo y pruebas de manera local.

### Prerrequisitos
* Python 3.10+ instalado.
* Node.js y npm instalados (para Expo).
* Entorno virtual de Python configurado.

---

### Paso 1: Levantar el servidor de Prefect
Para mantener un servidor centralizado de flujos y evitar conflictos de puertos con Expo, abre una terminal independiente y ejecuta:

```bash
prefect server start
