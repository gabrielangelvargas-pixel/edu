CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','supervisor','operator') NULL DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_sessions (
  token_hash CHAR(64) PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS processes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  display_order INT NOT NULL DEFAULT 0,
  accent CHAR(7) NOT NULL DEFAULT '#3f8067',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chain_models (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  description TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS model_processes (
  model_id BIGINT UNSIGNED NOT NULL,
  process_id BIGINT UNSIGNED NOT NULL,
  step_order INT NOT NULL,
  tolerance_percent DECIMAL(5,2) NULL,
  PRIMARY KEY (model_id, process_id),
  UNIQUE KEY uq_model_step (model_id, step_order),
  CONSTRAINT fk_model_process_model FOREIGN KEY (model_id) REFERENCES chain_models(id),
  CONSTRAINT fk_model_process_process FOREIGN KEY (process_id) REFERENCES processes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS operators (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(40) NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lot_daily_sequences (
  entry_date DATE PRIMARY KEY,
  last_number TINYINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  model_id BIGINT UNSIGNED NOT NULL,
  current_process_id BIGINT UNSIGNED NULL DEFAULT NULL,
  assigned_operator_id BIGINT UNSIGNED NULL,
  initial_weight DECIMAL(12,3) NOT NULL,
  current_weight DECIMAL(12,3) NOT NULL,
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('Pendiente','En proceso','Observado','Terminado') NOT NULL DEFAULT 'Pendiente',
  priority ENUM('Normal','Alta','Urgente') NOT NULL DEFAULT 'Normal',
  entered_at DATETIME NOT NULL,
  due_at DATE NULL DEFAULT NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_lot_model FOREIGN KEY (model_id) REFERENCES chain_models(id),
  CONSTRAINT fk_lot_process FOREIGN KEY (current_process_id) REFERENCES processes(id),
  CONSTRAINT fk_lot_operator FOREIGN KEY (assigned_operator_id) REFERENCES operators(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS lot_processes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_id BIGINT UNSIGNED NOT NULL,
  process_id BIGINT UNSIGNED NOT NULL,
  operator_id BIGINT UNSIGNED NULL,
  status ENUM('Pendiente','En proceso','Observado','Terminado') NOT NULL DEFAULT 'Pendiente',
  input_weight DECIMAL(12,3) NULL,
  output_weight DECIMAL(12,3) NULL,
  scrap_weight DECIMAL(12,3) NOT NULL DEFAULT 0,
  waste_weight DECIMAL(12,3) NOT NULL DEFAULT 0,
  started_at DATETIME NULL,
  started_time_known BOOLEAN NOT NULL DEFAULT FALSE,
  finished_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_lot_process_lot FOREIGN KEY (lot_id) REFERENCES lots(id),
  CONSTRAINT fk_lot_process_step FOREIGN KEY (process_id) REFERENCES processes(id),
  CONSTRAINT fk_lot_process_operator FOREIGN KEY (operator_id) REFERENCES operators(id),
  INDEX idx_lot_processes_lot (lot_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS metal_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_process_id BIGINT UNSIGNED NOT NULL,
  movement_type ENUM('Entrada','Salida','Recorte','Desperdicio','Ajuste') NOT NULL,
  weight DECIMAL(12,3) NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_movement_lot_process FOREIGN KEY (lot_process_id) REFERENCES lot_processes(id),
  INDEX idx_movements_process (lot_process_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO processes (id, name, slug, display_order, accent) VALUES
  (1, 'Fundición', 'fundicion', 1, '#3f8067'),
  (2, 'Laminación', 'laminacion', 2, '#6c8e79'),
  (3, 'Trefilado', 'trefilado', 3, '#aa8a4e'),
  (4, 'Armado', 'armado', 4, '#7e789d'),
  (5, 'Acabado', 'acabado', 5, '#587b97');

INSERT IGNORE INTO chain_models (id, code, name) VALUES
  (1, 'FOR-45', 'Forzada 45'), (2, 'ROL-60', 'Rolo 60'), (3, 'CAR-80', 'Cartier 80');

INSERT IGNORE INTO operators (id, code, name) VALUES
  (1, 'OP-001', 'Carlos Méndez'), (2, 'OP-002', 'Lucía Torres'), (3, 'OP-003', 'Miguel Ríos');

INSERT IGNORE INTO model_processes (model_id, process_id, step_order, tolerance_percent)
SELECT m.id, p.id, p.display_order, 2.00 FROM chain_models m CROSS JOIN processes p;

INSERT IGNORE INTO processes (name, slug, display_order, accent)
VALUES ('Laminación y trefilación', 'laminacion-trefilacion', 0, '#3f8067');
