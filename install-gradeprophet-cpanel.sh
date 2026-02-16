#!/bin/bash

#===============================================================================
#
#          FILE: install-gradeprophet-cpanel.sh
#
#         USAGE: bash install-gradeprophet-cpanel.sh
#
#   DESCRIPTION: Instalador de GradeProphet para servidores cPanel/WHM
#                Compatible con AlmaLinux 9 / Rocky Linux 9
#                Usa Apache (ya existente en cPanel) como reverse proxy
#
#       DOMAIN: flipslabengine.com
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
BACKEND_PORT=8001
FRONTEND_PORT=3000
DOMAIN="flipslabengine.com"

print_header() {
    echo ""
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║${NC}    ${GREEN}GradeProphet - Instalador para cPanel/WHM${NC}                ${BLUE}║${NC}"
    echo -e "${BLUE}║${NC}    ${YELLOW}Dominio: flipslabengine.com${NC}                               ${BLUE}║${NC}"
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
        print_error "Este script debe ejecutarse como root"
        print_info "Ejecuta: bash install-gradeprophet-cpanel.sh"
        exit 1
    fi
}

install_epel() {
    print_step "Instalando EPEL repository..."
    dnf install -y epel-release
    print_success "EPEL instalado"
}

install_nodejs() {
    print_step "Instalando Node.js 20 LTS..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_info "Node.js $(node -v) ya está instalado"
            npm install -g yarn serve 2>/dev/null || true
            return
        fi
    fi
    
    dnf module disable -y nodejs 2>/dev/null || true
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
    npm install -g yarn serve
    
    print_success "Node.js $(node -v) instalado"
}

install_python() {
    print_step "Instalando Python 3.11..."
    
    dnf install -y python3.11 python3.11-devel python3.11-pip 2>/dev/null || {
        dnf install -y python3 python3-devel python3-pip
    }
    
    print_success "Python instalado"
}

install_mongodb() {
    print_step "Instalando MongoDB 7.0..."
    
    if command -v mongod &> /dev/null; then
        print_info "MongoDB ya está instalado"
        systemctl start mongod 2>/dev/null || true
        systemctl enable mongod 2>/dev/null || true
        return
    fi
    
    cat > /etc/yum.repos.d/mongodb-org-7.0.repo << 'EOF'
[mongodb-org-7.0]
name=MongoDB Repository
baseurl=https://repo.mongodb.org/yum/redhat/9/mongodb-org/7.0/x86_64/
gpgcheck=1
enabled=1
gpgkey=https://pgp.mongodb.com/server-7.0.asc
EOF
    
    dnf install -y mongodb-org
    systemctl start mongod
    systemctl enable mongod
    
    print_success "MongoDB instalado y ejecutándose"
}

setup_application() {
    print_step "Configurando la aplicación..."
    
    mkdir -p $APP_DIR
    
    # Check if we're in the git repo directory
    if [ -f "./backend/server.py" ] && [ -f "./frontend/package.json" ]; then
        print_info "Copiando archivos desde directorio actual..."
        cp -r ./backend $APP_DIR/
        cp -r ./frontend $APP_DIR/
    elif [ -f "../backend/server.py" ]; then
        print_info "Copiando archivos desde directorio padre..."
        cp -r ../backend $APP_DIR/
        cp -r ../frontend $APP_DIR/
    else
        print_error "No se encontraron los archivos de la aplicación"
        print_info "Asegúrate de estar en el directorio gradeprophet/"
        exit 1
    fi
    
    print_success "Archivos copiados a $APP_DIR"
}

setup_python_environment() {
    print_step "Configurando entorno Python..."
    
    cd $APP_DIR/backend
    
    # Try python3.11 first, fallback to python3
    PYTHON_CMD="python3.11"
    if ! command -v python3.11 &> /dev/null; then
        PYTHON_CMD="python3"
    fi
    
    $PYTHON_CMD -m venv venv
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    deactivate
    
    print_success "Entorno Python configurado"
}

configure_environment() {
    print_step "Configurando variables de entorno..."
    
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  CONFIGURACIÓN DE API${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Necesitas una OpenAI API Key para el análisis de tarjetas"
    echo -e "  Obtén una en: ${BLUE}https://platform.openai.com/api-keys${NC}"
    echo ""
    read -p "  Ingresa tu OpenAI API Key: " OPENAI_KEY
    
    if [ -z "$OPENAI_KEY" ]; then
        print_warning "No se proporcionó API Key"
        OPENAI_KEY="sk-tu-api-key-aqui"
    fi
    
    BACKEND_URL="https://$DOMAIN"
    
    # Backend .env
    cat > $APP_DIR/backend/.env << EOF
MONGO_URL=mongodb://localhost:27017/gradeprophet
DB_NAME=gradeprophet
OPENAI_API_KEY=$OPENAI_KEY
CORS_ORIGINS=https://$DOMAIN,http://$DOMAIN,http://localhost:3000
EOF
    
    # Frontend .env
    cat > $APP_DIR/frontend/.env << EOF
REACT_APP_BACKEND_URL=https://$DOMAIN
EOF
    
    print_success "Variables de entorno configuradas"
}

setup_frontend() {
    print_step "Compilando Frontend..."
    
    cd $APP_DIR/frontend
    
    # Install dependencies
    yarn install --network-timeout 300000
    
    # Build for production
    yarn build
    
    print_success "Frontend compilado"
}

create_systemd_services() {
    print_step "Creando servicios del sistema..."
    
    # Backend service
    cat > /etc/systemd/system/gradeprophet-backend.service << EOF
[Unit]
Description=GradeProphet Backend API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
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
WorkingDirectory=$APP_DIR/frontend
ExecStart=/usr/bin/npx serve -s build -l $FRONTEND_PORT
Restart=always
RestartSec=10
Environment=PATH=/usr/bin:/usr/local/bin

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable gradeprophet-backend
    systemctl enable gradeprophet-frontend
    systemctl start gradeprophet-backend
    systemctl start gradeprophet-frontend
    
    # Wait a moment for services to start
    sleep 3
    
    print_success "Servicios creados y ejecutándose"
}

configure_apache_proxy() {
    print_step "Configurando Apache para $DOMAIN..."
    
    # Find the Apache config directory for this domain
    # In cPanel, configs are usually in /etc/apache2/conf.d/userdata/ or similar
    
    # Create a proxy configuration
    APACHE_CONF="/etc/apache2/conf.d/gradeprophet.conf"
    
    # Check if Apache2 or httpd
    if [ -d "/etc/httpd" ]; then
        APACHE_CONF="/etc/httpd/conf.d/gradeprophet.conf"
    fi
    
    cat > $APACHE_CONF << EOF
# GradeProphet Proxy Configuration for $DOMAIN
# This file configures Apache to proxy requests to the GradeProphet application

<IfModule mod_proxy.c>
    # Proxy settings for the domain
    <VirtualHost *:80>
        ServerName $DOMAIN
        ServerAlias www.$DOMAIN
        
        # Frontend proxy
        ProxyPreserveHost On
        ProxyPass / http://127.0.0.1:$FRONTEND_PORT/
        ProxyPassReverse / http://127.0.0.1:$FRONTEND_PORT/
        
        # Backend API proxy
        ProxyPass /api http://127.0.0.1:$BACKEND_PORT/api
        ProxyPassReverse /api http://127.0.0.1:$BACKEND_PORT/api
        
        # Increase timeout for AI analysis
        ProxyTimeout 120
        
        # Allow large file uploads
        LimitRequestBody 52428800
    </VirtualHost>
</IfModule>
EOF
    
    # Enable required Apache modules
    print_info "Habilitando módulos de Apache..."
    
    # For systems with a2enmod (Debian-style)
    if command -v a2enmod &> /dev/null; then
        a2enmod proxy proxy_http 2>/dev/null || true
    fi
    
    # For RHEL-style systems, modules are usually already available
    # Just need to ensure they're loaded
    
    # Test and reload Apache
    if command -v httpd &> /dev/null; then
        httpd -t 2>/dev/null && systemctl reload httpd
    elif command -v apache2 &> /dev/null; then
        apache2 -t 2>/dev/null && systemctl reload apache2
    fi
    
    print_success "Apache configurado"
}

configure_cpanel_domain() {
    print_step "Información para configurar en cPanel..."
    
    echo ""
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  CONFIGURACIÓN ADICIONAL EN WHM/cPanel${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  Para que ${GREEN}$DOMAIN${NC} funcione correctamente, necesitas:"
    echo ""
    echo -e "  ${BLUE}1. En WHM -> MultiPHP Manager:${NC}"
    echo -e "     Asegúrate de que el dominio tenga PHP habilitado"
    echo ""
    echo -e "  ${BLUE}2. El dominio debe apuntar a este servidor:${NC}"
    echo -e "     IP del servidor: $(curl -s ifconfig.me 2>/dev/null || echo 'Ver en WHM')"
    echo ""
    echo -e "  ${BLUE}3. Para SSL/HTTPS:${NC}"
    echo -e "     WHM -> SSL/TLS -> Install SSL Certificate"
    echo -e "     O usa AutoSSL en cPanel"
    echo ""
}

configure_selinux() {
    print_step "Configurando SELinux..."
    
    # Allow httpd to connect to network (for proxy)
    setsebool -P httpd_can_network_connect 1 2>/dev/null || true
    
    print_success "SELinux configurado"
}

configure_firewall() {
    print_step "Configurando firewall..."
    
    if command -v firewall-cmd &> /dev/null; then
        firewall-cmd --permanent --add-service=http 2>/dev/null || true
        firewall-cmd --permanent --add-service=https 2>/dev/null || true
        firewall-cmd --reload 2>/dev/null || true
        print_success "Firewall configurado"
    else
        print_info "Firewall no detectado (puede estar manejado por cPanel)"
    fi
}

verify_installation() {
    print_step "Verificando instalación..."
    
    echo ""
    
    # Check MongoDB
    if systemctl is-active --quiet mongod; then
        echo -e "  ${GREEN}✔${NC} MongoDB: Ejecutándose"
    else
        echo -e "  ${RED}✖${NC} MongoDB: No está ejecutándose"
    fi
    
    # Check Backend
    if systemctl is-active --quiet gradeprophet-backend; then
        echo -e "  ${GREEN}✔${NC} Backend: Ejecutándose"
    else
        echo -e "  ${RED}✖${NC} Backend: No está ejecutándose"
    fi
    
    # Check Frontend
    if systemctl is-active --quiet gradeprophet-frontend; then
        echo -e "  ${GREEN}✔${NC} Frontend: Ejecutándose"
    else
        echo -e "  ${RED}✖${NC} Frontend: No está ejecutándose"
    fi
    
    # Test local connections
    sleep 2
    if curl -s http://127.0.0.1:$BACKEND_PORT/api/ > /dev/null 2>&1; then
        echo -e "  ${GREEN}✔${NC} API Backend: Respondiendo"
    else
        echo -e "  ${YELLOW}⚠${NC} API Backend: Iniciando..."
    fi
    
    if curl -s http://127.0.0.1:$FRONTEND_PORT/ > /dev/null 2>&1; then
        echo -e "  ${GREEN}✔${NC} Frontend: Respondiendo"
    else
        echo -e "  ${YELLOW}⚠${NC} Frontend: Iniciando..."
    fi
    
    echo ""
}

print_completion() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║     ¡Instalación completada!                                ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  INFORMACIÓN DE LA INSTALACIÓN${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  📁 Directorio:     $APP_DIR"
    echo -e "  🌐 Dominio:        https://$DOMAIN"
    echo -e "  🔌 Backend:        http://127.0.0.1:$BACKEND_PORT"
    echo -e "  🖥️  Frontend:       http://127.0.0.1:$FRONTEND_PORT"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  COMANDOS ÚTILES${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  ${YELLOW}Ver estado de servicios:${NC}"
    echo -e "    systemctl status gradeprophet-backend"
    echo -e "    systemctl status gradeprophet-frontend"
    echo ""
    echo -e "  ${YELLOW}Ver logs:${NC}"
    echo -e "    journalctl -u gradeprophet-backend -f"
    echo -e "    journalctl -u gradeprophet-frontend -f"
    echo ""
    echo -e "  ${YELLOW}Reiniciar servicios:${NC}"
    echo -e "    systemctl restart gradeprophet-backend"
    echo -e "    systemctl restart gradeprophet-frontend"
    echo ""
    echo -e "  ${YELLOW}Editar API Key:${NC}"
    echo -e "    nano $APP_DIR/backend/.env"
    echo -e "    systemctl restart gradeprophet-backend"
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  SIGUIENTE PASO: CONFIGURAR PROXY EN CPANEL${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "  La aplicación está corriendo. Ahora necesitas configurar"
    echo -e "  el dominio $DOMAIN para que apunte a la aplicación."
    echo ""
    echo -e "  ${YELLOW}Opción A - Acceso directo (para probar):${NC}"
    echo -e "    http://$(curl -s ifconfig.me 2>/dev/null):$FRONTEND_PORT"
    echo ""
    echo -e "  ${YELLOW}Opción B - Configurar en cPanel:${NC}"
    echo -e "    Ver instrucciones arriba para configurar el proxy"
    echo ""
    echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Main
main() {
    print_header
    check_root
    
    echo -e "${YELLOW}Este script instalará GradeProphet para:${NC}"
    echo -e "  Dominio: ${GREEN}$DOMAIN${NC}"
    echo ""
    echo -e "${YELLOW}Se instalarán:${NC}"
    echo "  • Node.js 20"
    echo "  • Python 3.11"
    echo "  • MongoDB 7.0"
    echo "  • Configuración de servicios"
    echo ""
    echo -e "${YELLOW}NO se afectarán otras websites en este servidor.${NC}"
    echo ""
    read -p "¿Continuar? (s/n): " CONTINUE
    
    if [[ ! "$CONTINUE" =~ ^[Ss]$ ]]; then
        echo "Instalación cancelada"
        exit 0
    fi
    
    install_epel
    install_nodejs
    install_python
    install_mongodb
    setup_application
    setup_python_environment
    configure_environment
    setup_frontend
    create_systemd_services
    configure_selinux
    configure_firewall
    configure_cpanel_domain
    verify_installation
    print_completion
}

main "$@"
