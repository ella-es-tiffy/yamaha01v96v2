-- Yamaha 01V96 V2 Database Initialization

CREATE TABLE IF NOT EXISTS `mixer_scenes` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT,
    `scene_data` JSON NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `channel_settings` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `scene_id` INT,
    `channel_number` INT NOT NULL,
    `channel_name` VARCHAR(255),
    `fader_value` INT DEFAULT 0,
    `pan_value` INT DEFAULT 64,
    `mute` BOOLEAN DEFAULT FALSE,
    `solo` BOOLEAN DEFAULT FALSE,
    `gain` INT DEFAULT 0,
    `eq_high` INT DEFAULT 0,
    `eq_mid` INT DEFAULT 0,
    `eq_low` INT DEFAULT 0,
    `settings_json` JSON,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`scene_id`) REFERENCES `mixer_scenes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `midi_log` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `port` INT NOT NULL,
    `message_type` VARCHAR(50),
    `channel` INT,
    `data1` INT,
    `data2` INT,
    `raw_message` VARCHAR(255),
    `decoded_message` TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default scene
INSERT INTO `mixer_scenes` (`name`, `description`, `scene_data`)
VALUES ('Default', 'Default mixer configuration', '{}');

-- Create indexes
CREATE INDEX idx_scene_name ON mixer_scenes(name);
CREATE INDEX idx_channel_number ON channel_settings(channel_number);
CREATE INDEX idx_midi_timestamp ON midi_log(timestamp);
