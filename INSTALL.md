# GradeProphet - Guía de Instalación

## Instalación Automática (Recomendada)

### Requisitos Previos
- Servidor con **Ubuntu 20.04+** o **Debian 11+**
- Mínimo **2GB RAM**, **20GB disco**
- Acceso **root** (sudo)
- **OpenAI API Key** (obtener en https://platform.openai.com/api-keys)

### Pasos

1. **Descarga el proyecto** en tu servidor:
```bash
# Opción A: Desde GitHub (si lo subiste)
git clone https://github.com/tu-usuario/gradeprophet.git
cd gradeprophet

# Opción B: Subir archivos manualmente via SCP
scp -r ./gradeprophet usuario@tu-servidor:/home/usuario/
```

2. **Ejecuta el instalador:**
```bash
cd gradeprophet
sudo bash install-gradeprophet.sh
```

3. **Sigue las instrucciones:**
   - El script te pedirá tu **OpenAI API Key**
   - Ingresa tu **dominio** (o deja vacío para usar la IP)
   - Opcionalmente configura **SSL** con Let's Encrypt

4. **¡Listo!** Abre tu navegador en `http://tu-dominio.com`

---

## Instalación Manual

Si prefieres instalar manualmente:

### 1. Instalar dependencias

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn

# Python 3.11
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt install -y python3.11 python3.11-venv python3-pip

# MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update && sudo apt install -y mongodb-org
sudo systemctl enable --now mongod
```

### 2. Configurar Backend

```bash
cd backend

# Crear entorno virtual
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Crear archivo .env
cat > .env << EOF
MONGO_URL=mongodb://localhost:27017/gradeprophet
DB_NAME=gradeprophet
OPENAI_API_KEY=tu-api-key-aqui
CORS_ORIGINS=*
EOF

# Iniciar servidor (desarrollo)
uvicorn server:app --host 0.0.0.0 --port 8001
```

### 3. Configurar Frontend

```bash
cd frontend

# Instalar dependencias
yarn install

# Crear archivo .env
echo "REACT_APP_BACKEND_URL=http://tu-servidor:8001" > .env

# Compilar para producción
yarn build

# Servir archivos estáticos
npx serve -s build -l 3000
```

### 4. Configurar Nginx (Producción)

```bash
sudo apt install nginx

sudo nano /etc/nginx/sites-available/gradeprophet
```

Contenido:
```nginx
server {
    listen 80;
    server_name tu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://127.0.0.1:8001;
        proxy_read_timeout 120s;
        client_max_body_size 50M;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/gradeprophet /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. SSL con Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tu-dominio.com
```

---

## Comandos Útiles

### Ver estado de servicios
```bash
sudo systemctl status gradeprophet-backend
sudo systemctl status gradeprophet-frontend
sudo systemctl status mongod
```

### Ver logs
```bash
# Backend
sudo journalctl -u gradeprophet-backend -f

# Frontend
sudo journalctl -u gradeprophet-frontend -f

# MongoDB
sudo journalctl -u mongod -f
```

### Reiniciar servicios
```bash
sudo systemctl restart gradeprophet-backend
sudo systemctl restart gradeprophet-frontend
```

### Actualizar la aplicación
```bash
cd /opt/gradeprophet

# Actualizar código
git pull origin main

# Reinstalar dependencias si cambiaron
cd backend && source venv/bin/activate && pip install -r requirements.txt
cd ../frontend && yarn install && yarn build

# Reiniciar servicios
sudo systemctl restart gradeprophet-backend
sudo systemctl restart gradeprophet-frontend
```

---

## Desinstalar

```bash
sudo bash install-gradeprophet.sh --uninstall
```

---

## Solución de Problemas

### Error: "OPENAI_API_KEY not set"
```bash
sudo nano /opt/gradeprophet/backend/.env
# Agregar/corregir: OPENAI_API_KEY=sk-xxxxx
sudo systemctl restart gradeprophet-backend
```

### Error: "Connection refused" en MongoDB
```bash
sudo systemctl status mongod
sudo systemctl start mongod
```

### Error 502 Bad Gateway
```bash
# Verificar que los servicios estén corriendo
sudo systemctl status gradeprophet-backend
sudo systemctl status gradeprophet-frontend

# Ver logs para más detalles
sudo journalctl -u gradeprophet-backend -n 50
```

### Las imágenes no se suben
```bash
# Verificar límite de Nginx
sudo nano /etc/nginx/sites-available/gradeprophet
# Asegurar: client_max_body_size 50M;
sudo systemctl reload nginx
```

---

## Costos Estimados

| Concepto | Costo Mensual |
|----------|---------------|
| VPS (DigitalOcean/Linode) | $5-20 USD |
| Dominio (.com) | ~$1 USD |
| MongoDB Atlas (opcional) | Gratis |
| OpenAI API | ~$0.01-0.03 por análisis |

**Total estimado:** $6-25 USD/mes + uso de OpenAI

---

## Soporte

Si tienes problemas con la instalación, revisa:
1. Los logs con `journalctl`
2. Que MongoDB esté corriendo
3. Que la API Key de OpenAI sea válida
4. Que los puertos 80/443 estén abiertos en el firewall
