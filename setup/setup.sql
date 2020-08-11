DROP DATABASE IF EXISTS `questions_game`;

DROP USER IF EXISTS 'questions'@'localhost';
CREATE USER 'questions'@'localhost' IDENTIFIED BY 'password';

CREATE DATABASE `questions_game` CHARACTER SET UTF8mb4 COLLATE utf8mb4_bin;
GRANT ALL PRIVILEGES ON `questions_game`.* TO 'questions'@'localhost';

FLUSH PRIVILEGES;
USE `questions_game`;

CREATE TABLE `questions` (
  id INT NOT NULL AUTO_INCREMENT,
  question VARCHAR(160) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE `rooms` (
  id INT NOT NULL AUTO_INCREMENT,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  visibility ENUM("private", "public") DEFAULT "public",
  votingMethod ENUM("rotate", "democratic") DEFAULT "rotate",
  token VARCHAR(8),
  PRIMARY KEY (id)
);

CREATE TABLE `users` (
  id INT NOT NULL AUTO_INCREMENT,
  token VARCHAR(8) NOT NULL,
  name VARCHAR(12),
  iconName VARCHAR(16),
  iconColor SMALLINT,
  iconBackgroundColor SMALLINT,
  PRIMARY KEY (id)
);

CREATE TABLE `roomUsers` (
  user_id INT NOT NULL,
  room_id INT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  score INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, room_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE `messages` (
  id INT NOT NULL AUTO_INCREMENT,
  created_at INT UNSIGNED NOT NULL,
  user_id INT NOT NULL,
  room_id INT NOT NULL,
  body VARCHAR(200),
  type ENUM("normal", "system", "chained") DEFAULT "normal",
  PRIMARY KEY(id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE `messageLikes` (
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  since INT UNSIGNED NOT NULL,
  PRIMARY KEY(message_id, user_id),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);