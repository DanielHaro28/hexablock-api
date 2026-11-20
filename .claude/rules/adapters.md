---
paths:
  - "src/modules/*/presentation/**"
  - "src/modules/*/infrastructure/**"
  - "src/common/**"
  - "src/prisma/**"
  - "src/main.ts"
  - "prisma/**"
---

# Adaptadores y frameworks (capas 3 y 4)

- **Controladores delgados**: validan el DTO, llaman a un caso de uso y devuelven lo que dice el contrato. Rutas con prefijo `/v1`, salvo `/health`.
- **DTOs con `class-validator`** y `ValidationPipe` con `whitelist` y `forbidNonWhitelisted`. El rol nunca se acepta del cliente (SEC-API-03).
- **Errores**: siempre Problem Details (RFC 9457) con `code` y `errors` (JSON Pointer), desde `GlobalExceptionFilter`; `title` y `detail` fijos por tipo, sin stack ni datos internos (D-51, SEC-API-08). 401 con `WWW-Authenticate: Bearer`, 429 con `Retry-After`.
- **Autenticación**: contraseñas con argon2id, de 15 a 128 caracteres (D-52); JWT HS256 con secreto aleatorio de 32 bytes o más y vigencia de 24 h (D-44, SEC-API-02).
- **SQL**: solo Prisma o `$queryRaw` con parámetros. **Prohibido `$queryRawUnsafe`** (SEC-WEB-05).
- **Logs**: el interceptor de accesos nunca registra contraseñas, tokens ni correos (SEC-WEB-06).
- **Migraciones**: `prisma migrate dev` en local; en producción las aplica el CI con `migrate deploy`. `migrate reset` está prohibido.
- **El seed de niveles** (`prisma/seed/levels`) es copia de `hexablock-app/app/assets/levels/` y el CI comprueba que sean iguales (D-61).
