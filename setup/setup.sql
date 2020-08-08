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
  room_id INT,
  name VARCHAR(16),
  iconName VARCHAR(16),
  iconColor SMALLINT,
  iconBackgroundColor SMALLINT,
  score INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);