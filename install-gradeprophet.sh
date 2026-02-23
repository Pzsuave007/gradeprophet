#!/bin/bash

#===============================================================================
#
#          FILE: install-gradeprophet.sh
#
#         USAGE: sudo bash install-gradeprophet.sh
#
#   DESCRIPTION: Script de instalación automática para GradeProphet
#                AI-powered PSA grading predictor for sports cards
#
#       OPTIONS: --help, --uninstall
#  REQUIREMENTS: Ubuntu 20.04+ o Debian 11+
#        AUTHOR: GradeProphet
#       VERSION: 1.0
#
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="gradeprophet"
APP_DIR="/opt/gradeprophet"
APP_USER="gradeprophet"
BACKEND_PORT=8001
FRONTEND_PORT=3000

#-------------------------------------------------------------------------------
# Helper Functions
#-------------------------------------------------------------------------------

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}    ${GREEN}GradeProphet - Instalador Automático${NC}                      ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}    ${YELLOW}AI-Powered PSA Grading Predictor${NC}                          ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

print_info() {
    echo -e "${BLUE}  ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✖ $1${NC}"
}

print_success() {
    echo -e "${GREEN}  ✔ $1${NC}"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
}

#-------------------------------------------------------------------------------
# Installation Functions
#-------------------------------------------------------------------------------

install_system_dependencies() {
    print_step "Instalando dependencias del sistema..."
    
    apt-get update -qq
    apt-get install -y -qq \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        nginx \
        certbot \
        python3-certbot-nginx
    
    print_success "Dependencias del sistema instaladas"
}

install_nodejs() {
    print_step "Instalando Node.js 20 LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_info "Node.js $(node -v) ya está instalado"
            return
        fi
    fi
    
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    
    # Install yarn
    npm install -g yarn
    
    print_success "Node.js $(node -v) instalado"
}

install_python() {
    print_step "Instalando Python 3.11..."
    
    if command -v python3.11 &> /dev/null; then
        print_info "Python 3.11 ya está instalado"
    else
        add-apt-repository -y ppa:deadsnakes/ppa
        apt-get update -qq
        apt-get install -y -qq python3.11 python3.11-venv python3.11-dev python3-pip
    fi
    
    # Set python3.11 as default python3
    update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 2>/dev/null || true
    
    print_success "Python $(python3 --version) instalado"
}

install_mongodb() {
    print_step "Instalando MongoDB 7.0..."
    
    if command -v mongod &> /dev/null; then
        print_info "MongoDB ya está instalado"
        return
    fi
    
    # Import MongoDB public GPG key
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
        gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    
    # Add MongoDB repository
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | \
        tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    
    apt-get update -qq
    apt-get install -y -qq mongodb-org
    
    # Start and enable MongoDB
    systemctl start mongod
    systemctl enable mongod
    
    print_success "MongoDB instalado y ejecutándose"
}

create_app_user() {
    print_step "Creando usuario de la aplicación..."
    
    if id "$APP_USER" &>/dev/null; then
        print_info "Usuario $APP_USER ya existe"
    else
        useradd -r -s /bin/false -m -d /home/$APP_USER $APP_USER
        print_success "Usuario $APP_USER creado"
    fi
}

setup_application() {
    print_step "Configurando la aplicación..."
    
    # Create app directory
    mkdir -p $APP_DIR
    
    # Copy application files (assuming script is run from app directory)
    if [ -d "./backend" ] && [ -d "./frontend" ]; then
        print_info "Copiando archivos de la aplicación..."
        cp -r ./backend $APP_DIR/
        cp -r ./frontend $APP_DIR/
    else
        print_error "No se encontraron los directorios backend/ y frontend/"
        print_info "Asegúrate de ejecutar este script desde el directorio raíz de la aplicación"
        exit 1
    fi
    
    # Set ownership
    chown -R $APP_USER:$APP_USER $APP_DIR
    
    print_success "Aplicación configurada en $APP_DIR"
}

setup_python_environment() {
    print_step "Configurando entorno Python..."
    
    cd $APP_DIR/backend
    
    # Create virtual environment
    python3 -m venv venv
    
    # Activate and install dependencies
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    
    chown -R $APP_USER:$APP_USER $APP_DIR/backend/venv
    
    print_success "Entorno Python configurado"
}

setup_frontend() {
    print_step "Configurando Frontend..."
    
    cd $APP_DIR/frontend
    
    # Install dependencies
    sudo -u $APP_USER yarn install
    
    # Build for production
    sudo -u $APP_USER yarn build
    
    print_success "Frontend compilado"
}

configure_environment() {
    print_step "Configurando variables de entorno..."
    
    # Get OpenAI API Key from user
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  Se necesita tu OpenAI API Key para el análisis de tarjetas${NC}"
    echo -e "${YELLOW}  Obtén una en: https://platform.openai.com/api-keys${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    read -p "  Ingresa tu OpenAI API Key: " OPENAI_KEY
    
    if [ -z "$OPENAI_KEY" ]; then
        print_warning "No se proporcionó API Key. Deberás configurarla manualmente."
        OPENAI_KEY="tu-api-key-aqui"
    fi
    
    # Get domain
    echo ""
    read -p "  Ingresa tu dominio (ej: gradeprophet.com) o deja vacío para usar IP: " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        DOMAIN=$(curl -s ifconfig.me)
        BACKEND_URL="http://$DOMAIN"
    else
        BACKEND_URL="https://$DOMAIN"
    fi
    
    # Create backend .env
    cat > $APP_DIR/backend/.env << EOF
MONGO_URL=mongodb://localhost:27017/gradeprophet
DB_NAME=gradeprophet
OPENAI_API_KEY=$OPENAI_KEY
CORS_ORIGINS=$BACKEND_URL,http://localhost:3000
EOF
    
    # Create frontend .env
    cat > $APP_DIR/frontend/.env << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF
    
    chown $APP_USER:$APP_USER $APP_DIR/backend/.env
    chown $APP_USER:$APP_USER $APP_DIR/frontend/.env
    
    print_success "Variables de entorno configuradas"
    print_info "Backend URL: $BACKEND_URL"
}

create_systemd_services() {
    print_step "Creando servicios systemd..."
    
    # Backend service
    cat > /etc/systemd/system/gradeprophet-backend.service << EOF
[Unit]
Description=GradeProphet Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/backend
Environment=PATH=$APP_DIR/backend/venv/bin:/usr/bin
ExecStart=$APP_DIR/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port $BACKEND_PORT --workers 2
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Frontend service (serve built files with Node)
    cat > /etc/systemd/system/gradeprophet-frontend.service << EOF
[Unit]
Description=GradeProphet Frontend
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR/frontend
ExecStart=/usr/bin/npx serve -s build -l $FRONTEND_PORT
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF
    
    # Install serve globally for frontend
    npm install -g serve
    
    # Reload systemd
    systemctl daemon-reload
    
    # Enable and start services
    systemctl enable gradeprophet-backend
    systemctl enable gradeprophet-frontend
    systemctl start gradeprophet-backend
    systemctl start gradeprophet-frontend
    
    print_success "Servicios systemd creados y ejecutándose"
}

configure_nginx() {
    print_step "Configurando Nginx..."
    
    # Get domain from earlier or use IP
    if [ -z "$DOMAIN" ]; then
        DOMAIN=$(curl -s ifconfig.me)
        SERVER_NAME="_"
    else
        SERVER_NAME="$DOMAIN www.$DOMAIN"
    fi
    
    # Create Nginx config
    cat > /etc/nginx/sites-available/gradeprophet << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:$FRONTEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Increase timeouts for AI analysis
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        
        # Increase body size for image uploads
        client_max_body_size 50M;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/gradeprophet /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload nginx
    nginx -t
    systemctl reload nginx
    
    print_success "Nginx configurado"
}

setup_ssl() {
    print_step "Configurando SSL con Let's Encrypt..."
    
    if [ "$DOMAIN" = "_" ] || [ -z "$DOMAIN" ] || [[ "$DOMAIN" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        print_warning "SSL no configurado - se requiere un dominio válido"
        print_info "Para configurar SSL después, ejecuta:"
        print_info "  sudo certbot --nginx -d tu-dominio.com"
        return
    fi
    
    read -p "  ¿Configurar SSL automáticamente? (s/n): " SETUP_SSL
    
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        read -p "  Ingresa tu email para Let's Encrypt: " SSL_EMAIL
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $SSL_EMAIL
        print_success "SSL configurado"
    else
        print_info "Puedes configurar SSL después con: sudo certbot --nginx -d $DOMAIN"
    fi
}

setup_firewall() {
    print_step "Configurando firewall..."
    
    if command -v ufw &> /dev/null; then
        ufw allow 'Nginx Full'
        ufw allow OpenSSH
        ufw --force enable
        print_success "Firewall configurado"
    else
        print_warning "UFW no encontrado, saltando configuración de firewall"
    fi
}

print_completion() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║     ¡Instalación completada exitosamente!                   ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Información de la instalación:${NC}"
    echo -e "  📁 Directorio: $APP_DIR"
    echo -e "  🌐 URL: $BACKEND_URL"
    echo ""
    echo -e "${BLUE}Comandos útiles:${NC}"
    echo -e "  ${YELLOW}Ver estado:${NC}"
    echo -e "    sudo systemctl status gradeprophet-backend"
    echo -e "    sudo systemctl status gradeprophet-frontend"
    echo ""
    echo -e "  ${YELLOW}Ver logs:${NC}"
    echo -e "    sudo journalctl -u gradeprophet-backend -f"
    echo -e "    sudo journalctl -u gradeprophet-frontend -f"
    echo ""
    echo -e "  ${YELLOW}Reiniciar servicios:${NC}"
    echo -e "    sudo systemctl restart gradeprophet-backend"
    echo -e "    sudo systemctl restart gradeprophet-frontend"
    echo ""
    echo -e "  ${YELLOW}Editar configuración:${NC}"
    echo -e "    sudo nano $APP_DIR/backend/.env"
    echo -e "    sudo nano $APP_DIR/frontend/.env"
    echo ""
    echo -e "${GREEN}¡Abre $BACKEND_URL en tu navegador para usar GradeProphet!${NC}"
    echo ""
}

#-------------------------------------------------------------------------------
# Uninstall Function
#-------------------------------------------------------------------------------

uninstall() {
    print_header
    print_step "Desinstalando GradeProphet..."
    
    # Stop and disable services
    systemctl stop gradeprophet-backend 2>/dev/null || true
    systemctl stop gradeprophet-frontend 2>/dev/null || true
    systemctl disable gradeprophet-backend 2>/dev/null || true
    systemctl disable gradeprophet-frontend 2>/dev/null || true
    
    # Remove service files
    rm -f /etc/systemd/system/gradeprophet-backend.service
    rm -f /etc/systemd/system/gradeprophet-frontend.service
    systemctl daemon-reload
    
    # Remove nginx config
    rm -f /etc/nginx/sites-enabled/gradeprophet
    rm -f /etc/nginx/sites-available/gradeprophet
    systemctl reload nginx 2>/dev/null || true
    
    # Remove app directory
    rm -rf $APP_DIR
    
    # Remove user
    userdel -r $APP_USER 2>/dev/null || true
    
    print_success "GradeProphet desinstalado"
    print_info "MongoDB y sus datos NO fueron eliminados"
    print_info "Para eliminar MongoDB: sudo apt remove mongodb-org*"
}

#-------------------------------------------------------------------------------
# Main
#-------------------------------------------------------------------------------

main() {
    print_header
    
    # Check for help flag
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        echo "Uso: sudo bash install-gradeprophet.sh [OPCIÓN]"
        echo ""
        echo "Opciones:"
        echo "  --help, -h      Muestra esta ayuda"
        echo "  --uninstall     Desinstala GradeProphet"
        echo ""
        exit 0
    fi
    
    # Check for uninstall flag
    if [[ "$1" == "--uninstall" ]]; then
        check_root
        uninstall
        exit 0
    fi
    
    check_root
    
    echo -e "${YELLOW}Este script instalará:${NC}"
    echo "  • Node.js 20 LTS"
    echo "  • Python 3.11"
    echo "  • MongoDB 7.0"
    echo "  • Nginx (reverse proxy)"
    echo "  • Certificado SSL (opcional)"
    echo ""
    read -p "¿Continuar con la instalación? (s/n): " CONTINUE
    
    if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
        echo "Instalación cancelada"
        exit 0
    fi
    
    install_system_dependencies
    install_nodejs
    install_python
    install_mongodb
    create_app_user
    setup_application
    setup_python_environment
    configure_environment
    setup_frontend
    create_systemd_services
    configure_nginx
    setup_ssl
    setup_firewall
    print_completion
}

main "$@"
