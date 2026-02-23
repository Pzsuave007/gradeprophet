# Como Actualizar tu Servidor GradeProphet

## Instrucciones Rapidas (Solo 2 pasos)

### Paso 1: Conectate a tu servidor
1. Ve a WHM/cPanel
2. Abre el **Terminal** (WHM > Herramientas de desarrollador > Terminal)
3. O conectate por SSH si lo prefieres

### Paso 2: Ejecuta este comando
Copia y pega este comando completo:

```bash
cd /home/gradeprophet && git pull origin main && chmod +x update-server.sh && sudo ./update-server.sh
```

**Eso es todo!** El script hara lo siguiente automaticamente:
- Descargara el codigo nuevo de GitHub
- Copiara los archivos actualizados
- Compilara el frontend
- Reiniciara los servicios

---

## Que se actualiza con esto?

**Fix del Selector de Imagenes eBay:**
- Antes: No podias seleccionar las imagenes importadas de eBay
- Ahora: Haz clic en cualquier imagen y aparecera un menu para asignarla como Frente, Dorso o Esquinas

---

## Si algo sale mal

### Error: "permission denied"
Ejecuta con sudo:
```bash
sudo ./update-server.sh
```

### Error: "command not found: git"
Instala git primero:
```bash
sudo yum install git -y
```

### Error: "command not found: yarn"
```bash
sudo npm install -g yarn
```

### El script no se ejecuta
Dale permisos de ejecucion:
```bash
chmod +x update-server.sh
```

---

## Verificar que funciona

Despues de actualizar:
1. Ve a https://flipslabengine.com
2. Pega una URL de eBay en el campo de importar
3. Haz clic en las imagenes importadas
4. Deberia aparecer el menu para asignar Frente/Dorso/Esquinas

---

## Soporte

Si tienes problemas, toma una captura de pantalla del error y compartela conmigo.
