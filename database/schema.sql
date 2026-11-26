CREATE TABLE IF NOT EXISTS usuarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(80) NOT NULL UNIQUE,
  nombre_visible VARCHAR(120) NOT NULL,
  hash_contrasena VARCHAR(255) NOT NULL,
  rol ENUM('admin','supervisor','operator') NULL DEFAULT NULL,
  activo BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sesiones_usuario (
  hash_token CHAR(64) PRIMARY KEY,
  usuario_id BIGINT UNSIGNED NOT NULL,
  fecha_vencimiento DATETIME NOT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  INDEX idx_sesiones_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procesos (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  identificador_url VARCHAR(100) NOT NULL UNIQUE,
  orden_visualizacion INT NOT NULL DEFAULT 0,
  color_acento CHAR(7) NOT NULL DEFAULT '#3f8067',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS modelos_cadena (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nombre VARCHAR(120) NOT NULL,
  descripcion TEXT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procesos_modelo (
  modelo_id BIGINT UNSIGNED NOT NULL,
  proceso_id BIGINT UNSIGNED NOT NULL,
  orden_etapa INT NOT NULL,
  porcentaje_tolerancia DECIMAL(5,2) NULL,
  PRIMARY KEY (modelo_id, proceso_id),
  UNIQUE KEY uq_modelo_orden_etapa (modelo_id, orden_etapa),
  CONSTRAINT fk_proceso_modelo_modelo FOREIGN KEY (modelo_id) REFERENCES modelos_cadena(id),
  CONSTRAINT fk_proceso_modelo_proceso FOREIGN KEY (proceso_id) REFERENCES procesos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operarios (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  codigo VARCHAR(40) NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS secuencias_diarias_lotes (
  fecha_alta DATE PRIMARY KEY,
  ultimo_numero TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lotes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NOT NULL UNIQUE,
  modelo_id BIGINT UNSIGNED NOT NULL,
  proceso_actual_id BIGINT UNSIGNED NULL DEFAULT NULL,
  operario_asignado_id BIGINT UNSIGNED NULL,
  gramaje_inicial DECIMAL(12,3) NOT NULL,
  gramaje_actual DECIMAL(12,3) NOT NULL,
  avance TINYINT UNSIGNED NOT NULL DEFAULT 0,
  estado ENUM('Pendiente','En proceso','Observado','Terminado') NOT NULL DEFAULT 'Pendiente',
  prioridad ENUM('Normal','Alta','Urgente') NOT NULL DEFAULT 'Normal',
  fecha_alta DATETIME NOT NULL,
  fecha_entrega DATE NULL DEFAULT NULL,
  fecha_finalizacion DATETIME NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lote_modelo FOREIGN KEY (modelo_id) REFERENCES modelos_cadena(id),
  CONSTRAINT fk_lote_proceso FOREIGN KEY (proceso_actual_id) REFERENCES procesos(id),
  CONSTRAINT fk_lote_operario FOREIGN KEY (operario_asignado_id) REFERENCES operarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS procesos_lote (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lote_id BIGINT UNSIGNED NOT NULL,
  proceso_id BIGINT UNSIGNED NOT NULL,
  operario_id BIGINT UNSIGNED NULL,
  estado ENUM('Pendiente','En proceso','Observado','Terminado') NOT NULL DEFAULT 'Pendiente',
  gramaje_entrada DECIMAL(12,3) NULL,
  gramaje_salida DECIMAL(12,3) NULL,
  gramaje_recortes DECIMAL(12,3) NOT NULL DEFAULT 0,
  gramaje_merma DECIMAL(12,3) NOT NULL DEFAULT 0,
  fecha_inicio DATETIME NULL,
  hora_inicio_registrada BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_fin DATETIME NULL,
  notas TEXT NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proceso_lote_lote FOREIGN KEY (lote_id) REFERENCES lotes(id),
  CONSTRAINT fk_proceso_lote_proceso FOREIGN KEY (proceso_id) REFERENCES procesos(id),
  CONSTRAINT fk_proceso_lote_operario FOREIGN KEY (operario_id) REFERENCES operarios(id),
  INDEX idx_procesos_lote_lote (lote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS movimientos_metal (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proceso_lote_id BIGINT UNSIGNED NOT NULL,
  tipo_movimiento ENUM('Entrada','Salida','Recorte','Desperdicio','Ajuste') NOT NULL,
  gramaje DECIMAL(12,3) NOT NULL,
  notas VARCHAR(255) NULL,
  fecha_creacion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movimiento_proceso_lote FOREIGN KEY (proceso_lote_id) REFERENCES procesos_lote(id),
  INDEX idx_movimientos_proceso (proceso_lote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO procesos (id, nombre, identificador_url, orden_visualizacion, color_acento) VALUES
  (1, 'Fundición', 'fundicion', 1, '#3f8067'),
  (2, 'Laminación', 'laminacion', 2, '#6c8e79'),
  (3, 'Trefilado', 'trefilado', 3, '#aa8a4e'),
  (4, 'Armado', 'armado', 4, '#7e789d'),
  (5, 'Acabado', 'acabado', 5, '#587b97');

INSERT IGNORE INTO modelos_cadena (id, codigo, nombre) VALUES
  (1, 'FOR-45', 'Forzada 45'), (2, 'ROL-60', 'Rolo 60'), (3, 'CAR-80', 'Cartier 80');

INSERT IGNORE INTO operarios (id, codigo, nombre) VALUES
  (1, 'OP-001', 'Carlos Méndez'), (2, 'OP-002', 'Lucía Torres'), (3, 'OP-003', 'Miguel Ríos');

INSERT IGNORE INTO procesos_modelo (modelo_id, proceso_id, orden_etapa, porcentaje_tolerancia)
SELECT m.id, p.id, p.orden_visualizacion, 2.00 FROM modelos_cadena m CROSS JOIN procesos p;

INSERT IGNORE INTO procesos (nombre, identificador_url, orden_visualizacion, color_acento)
VALUES ('Laminación y trefilación', 'laminacion-trefilacion', 0, '#3f8067');
