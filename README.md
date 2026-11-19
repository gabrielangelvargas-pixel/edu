# Cadena — control de producción

Base mínima para registrar y seguir lotes durante la fabricación de cadenas de plata.

## Desarrollo local

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`. La aplicación requiere una conexión MySQL configurada.

## Conectar MySQL

1. Crear una base MySQL con codificación `utf8mb4`.
2. Ejecutar `database/schema.sql` desde phpMyAdmin o el cliente MySQL.
3. Copiar `.env.example` como `.env.local` y completar las credenciales.
4. Reiniciar la aplicación.

La interfaz mostrará **MySQL conectado** cuando la configuración esté activa.

## Despliegue en Hostinger

- Framework: Next.js
- Versión de Node.js: 24
- Comando de instalación: `npm ci`
- Comando de compilación: `npm run build`
- Comando de inicio: `npm run start`
- Rama de despliegue: `main`

Agregar en Hostinger las variables `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`. No subir archivos `.env` al repositorio.

## Alcance actual

- Panel adaptable a computadora y celular.
- Indicadores de producción y flujo por procesos.
- Búsqueda de lotes.
- Alta básica de lotes.
- Persistencia MySQL al configurar el entorno.
- Esquema flexible para modelos, rutas, procesos, operadores, pesos, recortes y desperdicios.

La autenticación, edición de procesos y carga completa de movimientos se incorporarán después de validar este flujo con el cliente.
