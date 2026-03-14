#!/bin/bash
echo "=== Arreglando .htaccess ==="

# Backup
cp /home/flipcardsuni2/public_html/.htaccess /home/flipcardsuni2/public_html/.htaccess.bak

# Nuevo .htaccess: sirve archivos de public_html + proxy API al backend
cat > /home/flipcardsuni2/public_html/.htaccess << 'EOF'
RewriteEngine On

# Proxy to Backend API
RewriteCond %{REQUEST_URI} ^/api
RewriteRule ^(.*)$ http://127.0.0.1:8001/$1 [P,L]

# Serve static files directly from public_html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]

# php -- BEGIN cPanel-generated handler, do not edit
<IfModule mime_module>
  AddHandler application/x-httpd-ea-php81 .php .php8 .phtml
</IfModule>
# php -- END cPanel-generated handler, do not edit
EOF

echo "OK! .htaccess actualizado"
echo "Backup guardado en .htaccess.bak"
