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

## Acceso inicial

Al primer acceso, la aplicación crea las tablas de autenticación y el usuario administrador si todavía no existe:

- Usuario: `Admin`
- Contraseña: `admin123`

La contraseña se guarda como hash, nunca como texto plano. Las credenciales iniciales pueden personalizarse con `INITIAL_ADMIN_USERNAME` e `INITIAL_ADMIN_PASSWORD` antes del primer inicio.

Los demás usuarios pueden registrarse desde `/register`. Las cuentas nuevas se crean inactivas y sin rol; un administrador debe asignarles un perfil y activarlas desde **Administración → Usuarios**.

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
- Login con usuario y contraseña, sesión segura y rutas protegidas.
- Registro con aprobación administrativa y perfiles Administrador, Supervisor y Operario.
- Persistencia MySQL al configurar el entorno.
- Esquema flexible para modelos, rutas, procesos, operadores, pesos, recortes y desperdicios.

La edición de procesos y la carga completa de movimientos se incorporarán después de validar este flujo con el cliente.
