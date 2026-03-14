# Agentes Hub - Backend API

API Backend para conectar el frontend con el VPS y gestionar agentes autónomos.

## Stack

- **Runtime:** Node.js 20+
- **Framework:** Express
- **Database:** Supabase (PostgreSQL)
- **SSH:** node-ssh
- **Deploy:** Railway

## Endpoints

### Health Check
```
GET /health
```

### VPS Management
```
GET  /api/vps/status          - Check VPS connection
POST /api/vps/command         - Execute command on VPS
GET  /api/vps/directory       - List directory contents
GET  /api/vps/file            - Read file from VPS
GET  /api/vps/pm2/status      - Get PM2 processes
POST /api/vps/pm2/restart     - Restart PM2 process
```

### Agentes
```
POST /api/agentes/execute     - Execute agent task
GET  /api/agentes/status      - Get agents status
GET  /api/agentes/skills      - Get agent skills/prompts
PUT  /api/agentes/skills/:id  - Update agent skill
```

### Proyectos
```
GET    /api/proyectos         - Get all projects
GET    /api/proyectos/:id     - Get single project
POST   /api/proyectos         - Create project
PUT    /api/proyectos/:id     - Update project
DELETE /api/proyectos/:id     - Delete project
GET    /api/proyectos/:id/tareas - Get project tasks
```

## Setup Local

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar variables de entorno
```bash
cp .env.example .env
```

Edita `.env` con tus credenciales reales.

### 3. Ejecutar en desarrollo
```bash
npm run dev
```

El servidor estará en `http://localhost:3001`

## Deploy en Railway

### 1. Crear proyecto en Railway

- Ve a https://railway.app
- New Project → Deploy from GitHub repo
- Selecciona este repo

### 2. Configurar variables de entorno

En Railway → Variables, agrega:

```
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
FRONTEND_URL=https://tu-app.netlify.app
VPS_HOST=178.156.188.72
VPS_USER=root
VPS_PASSWORD=tu-password-vps
```

### 3. Deploy

Railway detectará automáticamente `package.json` y ejecutará:
```bash
npm install
npm start
```

### 4. Obtener URL de producción

Railway te dará una URL como:
```
https://agentes-backend-production.up.railway.app
```

Copia esta URL y agrégala al frontend en:
```
RAILWAY_API_URL=https://tu-backend.railway.app
```

## Seguridad

- ✅ CORS configurado solo para frontend
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet para headers de seguridad
- ✅ Whitelist de comandos SSH permitidos
- ✅ Service key de Supabase (no anon key)

## Testing

```bash
# Health check
curl https://tu-backend.railway.app/health

# VPS status
curl https://tu-backend.railway.app/api/vps/status

# Execute agent
curl -X POST https://tu-backend.railway.app/api/agentes/execute \
  -H "Content-Type: application/json" \
  -d '{"agente_tipo":"investigacion","input":"test"}'
```

## Logs

Todos los eventos se registran en Supabase tabla `logs`:
- Errores
- Comandos ejecutados
- Tareas de agentes
- Cambios en proyectos

## Estructura

```
agentes-backend/
├── server.js              # Express server principal
├── lib/
│   └── ssh.js             # Cliente SSH para VPS
├── routes/
│   ├── vps.js             # Rutas de VPS
│   ├── agentes.js         # Rutas de agentes
│   └── proyectos.js       # Rutas de proyectos
├── package.json
└── .env.example
```

## Troubleshooting

### Error de conexión SSH

Si falla la conexión al VPS:
1. Verifica que `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD` sean correctos
2. Verifica que Railway puede hacer SSH al puerto 22
3. Considera usar SSH key en vez de password

### CORS errors

Si el frontend no puede conectarse:
1. Verifica que `FRONTEND_URL` esté correcta en Railway
2. Debe incluir protocolo `https://`
3. Sin trailing slash

## Licencia

MIT
