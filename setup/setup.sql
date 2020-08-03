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