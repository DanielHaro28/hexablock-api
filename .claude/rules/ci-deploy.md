---
paths:
  - ".github/**"
  - "Dockerfile"
  - "docker-compose*.yml"
  - "deploy/**"
  - "Caddyfile"
---

# CI y despliegue

- Cada workflow declara `permissions:` mínimos (`contents: read` por defecto). **Prohibido `pull_request_target`** con checkout del código del PR (SEC-WEB-03). Acciones de terceros fijadas por versión mayor o SHA.
- **El deploy corre solo en `push` a `main`** y usa el environment `production` con `EC2_HOST` y `EC2_SSH_KEY` (SEC-WEB-03, W-06). Nadie despliega desde su computadora (SEC-AGT-03).
- **Imagen Docker**: base con etiqueta fija, sin secretos en la imagen (SEC-WEB-04); los secretos llegan por variables de entorno en EC2.
- **PostgreSQL no se expone**: solo Caddy escucha en 80 y 443 (SEC-WEB-01).
- Un cambio aquí avisa al equipo (casilla de la plantilla de PR, SEC-AGT-05).
