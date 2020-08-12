DROP DATABASE IF EXISTS `questions`;

DROP USER IF EXISTS 'questions'@'localhost';
CREATE USER 'questions'@'localhost' IDENTIFIED BY 'password';

CREATE DATABASE `questions` CHARACTER SET UTF8mb4 COLLATE utf8mb4_bin;
GRANT ALL PRIVILEGES ON `questions`.* TO 'questions'@'localhost';

FLUSH PRIVILEGES;
USE `questions`;

CREATE TABLE `questions` (
  id INT NOT NULL AUTO_INCREMENT,
  question VARCHAR(160) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE `rooms` (
  id INT NOT NULL AUTO_INCREMENT,
  lastActive INT UNSIGNED NOT NULL,
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
  userId INT NOT NULL,
  roomId INT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  score INT NOT NULL DEFAULT 0,
  PRIMARY KEY (userId, roomId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE `messages` (
  id INT NOT NULL AUTO_INCREMENT,
  createdAt INT UNSIGNED NOT NULL,
  userId INT NOT NULL,
  roomId INT NOT NULL,
  body VARCHAR(200),
  type ENUM("normal", "system", "chained") DEFAULT "normal",
  PRIMARY KEY(id),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE `messageLikes` (
  messageId INT NOT NULL,
  userId INT NOT NULL,
  since INT UNSIGNED NOT NULL,
  PRIMARY KEY(messageId, userId),
  FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);