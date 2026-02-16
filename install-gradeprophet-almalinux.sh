#!/bin/bash

#===============================================================================
#
#          FILE: install-gradeprophet-almalinux.sh
#
#         USAGE: sudo bash install-gradeprophet-almalinux.sh
#
#   DESCRIPTION: Script de instalación para GradeProphet en AlmaLinux 9 / RHEL 9
#                AI-powered PSA grading predictor for sports cards
#
#  REQUIREMENTS: AlmaLinux 9, Rocky Linux 9, RHEL 9, CentOS Stream 9
#        AUTHOR: GradeProphet
#       VERSION: 1.0
#
#===============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
APP_NAME="gradeprophet"
APP_DIR="/opt/gradeprophet"
APP_USER="gradeprophet"
BACKEND_PORT=8001
FRONTEND_PORT=3000

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}    ${GREEN}GradeProphet - Instalador para AlmaLinux 9${NC}              ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}    ${YELLOW}AI-Powered PSA Grading Predictor${NC}                          ${BLUE}║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() { echo -e "\n${GREEN}▶ $1${NC}"; }
print_info() { echo -e "${BLUE}  ℹ $1${NC}"; }
print_warning() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
print_error() { echo -e "${RED}  ✖ $1${NC}"; }
print_success() { echo -e "${GREEN}  ✔ $1${NC}"; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "Este script debe ejecutarse como root (sudo)"
        exit 1
    fi
}

check_almalinux() {
    if [ ! -f /etc/almalinux-release ] && [ ! -f /etc/rocky-release ] && [ ! -f /etc/redhat-release ]; then
        print_warning "Este script está diseñado para AlmaLinux/Rocky/RHEL 9"
        read -p "¿Continuar de todos modos? (s/n): " CONTINUE
        if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
            exit 1
        fi
    fi
}

install_system_dependencies() {
    print_step "Instalando dependencias del sistema..."
    
    dnf install -y epel-release
    dnf install -y \
        curl \
        wget \
        git \
        gcc \
        gcc-c++ \
        make \
        openssl-devel \
        bzip2-devel \
        libffi-devel \
        zlib-devel \
        nginx \
        firewalld
    
    # Start firewalld if not running
    systemctl start firewalld 2>/dev/null || true
    systemctl enable firewalld 2>/dev/null || true
    
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
    
    # Install Node.js 20 from NodeSource
    dnf module disable -y nodejs 2>/dev/null || true
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    
    # Install yarn globally
    npm install -g yarn
    
    print_success "Node.js $(node -v) instalado"
}

install_python() {
    print_step "Instalando Python 3.11..."
    
    if command -v python3.11 &> /dev/null; then
        print_info "Python 3.11 ya está instalado"
    else
        dnf install -y python3.11 python3.11-devel python3.11-pip
    fi
    
    print_success "Python $(python3.11 --version) instalado"
}

install_mongodb() {
    print_step "Instalando MongoDB 7.0..."
    
    if command -v mongod &> /dev/null; then
        print_info "MongoDB ya está instalado"
        systemctl start mongod 2>/dev/null || true
        return
    fi
    
    # Create MongoDB repo file
    cat > /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
    
    dnf install -y mongodb-org
    
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
        useradd -r -s /sbin/nologin -m -d /home/$APP_USER $APP_USER
        print_success "Usuario $APP_USER creado"
    fi
}

setup_application() {
    print_step "Configurando la aplicación..."
    
    mkdir -p $APP_DIR
    
    if [ -d "./backend" ] && [ -d "./frontend" ]; then
        print_info "Copiando archivos de la aplicación..."
        cp -r ./backend $APP_DIR/
        cp -r ./frontend $APP_DIR/
    else
        print_error "No se encontraron los directorios backend/ y frontend/"
        print_info "Asegúrate de ejecutar este script desde el directorio del proyecto"
        exit 1
    fi
    
    chown -R $APP_USER:$APP_USER $APP_DIR
    
    print_success "Aplicación configurada en $APP_DIR"
}

setup_python_environment() {
    print_step "Configurando entorno Python..."
    
    cd $APP_DIR/backend
    
    python3.11 -m venv venv
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
    
    sudo -u $APP_USER yarn install --network-timeout 300000
    sudo -u $APP_USER yarn build
    
    print_success "Frontend compilado"
}

configure_environment() {
    print_step "Configurando variables de entorno..."
    
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
    
    echo ""
    read -p "  Ingresa tu dominio (ej: gradeprophet.com) o deja vacío para usar IP: " DOMAIN
    
    if [ -z "$DOMAIN" ]; then
        DOMAIN=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
        BACKEND_URL="http://$DOMAIN"
    else
        BACKEND_URL="https://$DOMAIN"
    fi
    
    cat > $APP_DIR/backend/.env << EOF
MONGO_URL=mongodb://localhost:27017/gradeprophet
DB_NAME=gradeprophet
OPENAI_API_KEY=$OPENAI_KEY
CORS_ORIGINS=$BACKEND_URL,http://localhost:3000
EOF
    
    cat > $APP_DIR/frontend/.env << EOF
REACT_APP_BACKEND_URL=$BACKEND_URL
EOF
    
    chown $APP_USER:$APP_USER $APP_DIR/backend/.env
    chown $APP_USER:$APP_USER $APP_DIR/frontend/.env
    
    # Rebuild frontend with new env
    cd $APP_DIR/frontend
    sudo -u $APP_USER yarn build
    
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
    
    # Frontend service
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
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
EOF
    
    npm install -g serve
    
    systemctl daemon-reload
    systemctl enable gradeprophet-backend
    systemctl enable gradeprophet-frontend
    systemctl start gradeprophet-backend
    systemctl start gradeprophet-frontend
    
    print_success "Servicios systemd creados y ejecutándose"
}

configure_nginx() {
    print_step "Configurando Nginx..."
    
    if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
        DOMAIN=$(curl -s ifconfig.me 2>/dev/null || echo "localhost")
        SERVER_NAME="_"
    else
        SERVER_NAME="$DOMAIN www.$DOMAIN"
    fi
    
    cat > /etc/nginx/conf.d/gradeprophet.conf << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

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

    location /api {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_read_timeout 120s;
        proxy_connect_timeout 120s;
        proxy_send_timeout 120s;
        
        client_max_body_size 50M;
    }
}
EOF
    
    # Remove default nginx page
    rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
    
    # Test and start nginx
    nginx -t
    systemctl enable nginx
    systemctl restart nginx
    
    print_success "Nginx configurado"
}

configure_selinux() {
    print_step "Configurando SELinux..."
    
    # Allow nginx to connect to backend
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    
    print_success "SELinux configurado"
}

configure_firewall() {
    print_step "Configurando firewall..."
    
    firewall-cmd --permanent --add-service=http 2>/dev/null || true
    firewall-cmd --permanent --add-service=https 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    
    print_success "Firewall configurado"
}

setup_ssl() {
    print_step "Configurando SSL con Let's Encrypt..."
    
    if [ "$SERVER_NAME" = "_" ] || [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ]; then
        print_warning "SSL no configurado - se requiere un dominio válido"
        print_info "Para configurar SSL después, ejecuta:"
        print_info "  sudo dnf install certbot python3-certbot-nginx"
        print_info "  sudo certbot --nginx -d tu-dominio.com"
        return
    fi
    
    read -p "  ¿Configurar SSL automáticamente? (s/n): " SETUP_SSL
    
    if [[ "$SETUP_SSL" =~ ^[Ss]$ ]]; then
        dnf install -y certbot python3-certbot-nginx
        read -p "  Ingresa tu email para Let's Encrypt: " SSL_EMAIL
        certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m $SSL_EMAIL
        print_success "SSL configurado"
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
    echo ""
    echo -e "${GREEN}¡Abre $BACKEND_URL en tu navegador para usar GradeProphet!${NC}"
    echo ""
}

# Uninstall function
uninstall() {
    print_header
    print_step "Desinstalando GradeProphet..."
    
    systemctl stop gradeprophet-backend 2>/dev/null || true
    systemctl stop gradeprophet-frontend 2>/dev/null || true
    systemctl disable gradeprophet-backend 2>/dev/null || true
    systemctl disable gradeprophet-frontend 2>/dev/null || true
    
    rm -f /etc/systemd/system/gradeprophet-backend.service
    rm -f /etc/systemd/system/gradeprophet-frontend.service
    systemctl daemon-reload
    
    rm -f /etc/nginx/conf.d/gradeprophet.conf
    systemctl reload nginx 2>/dev/null || true
    
    rm -rf $APP_DIR
    userdel -r $APP_USER 2>/dev/null || true
    
    print_success "GradeProphet desinstalado"
}

# Main
main() {
    print_header
    
    if [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
        echo "Uso: sudo bash install-gradeprophet-almalinux.sh [OPCIÓN]"
        echo ""
        echo "Opciones:"
        echo "  --help, -h      Muestra esta ayuda"
        echo "  --uninstall     Desinstala GradeProphet"
        exit 0
    fi
    
    if [[ "$1" == "--uninstall" ]]; then
        check_root
        uninstall
        exit 0
    fi
    
    check_root
    check_almalinux
    
    echo -e "${YELLOW}Este script instalará en AlmaLinux 9:${NC}"
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
    configure_selinux
    configure_firewall
    setup_ssl
    print_completion
}

main "$@"
