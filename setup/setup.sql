DROP DATABASE IF EXISTS `questions`;

DROP USER IF EXISTS 'questions'@'localhost';
CREATE USER 'questions'@'%' IDENTIFIED BY 'password';

CREATE DATABASE `questions` CHARACTER SET UTF8mb4 COLLATE utf8mb4_bin;
GRANT ALL PRIVILEGES ON `questions`.* TO 'questions'@'%';

FLUSH PRIVILEGES;
USE `questions`;

CREATE TABLE `questions` (
  id INT NOT NULL AUTO_INCREMENT,
  question VARCHAR(160) NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE `rooms` (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(32),
  lastActive INT UNSIGNED NOT NULL,
  visibility ENUM("private", "public") DEFAULT "public",
  votingMethod ENUM("winner", "rotate", "democratic") DEFAULT "rotate",
  token VARCHAR(8),
  state ENUM("picking_question", "collecting_answers", "reading_answers", "viewing_results") DEFAULT "picking_question",
  PRIMARY KEY (id)
);

CREATE TABLE `roomQuestions` (
  roomId INT NOT NULL,
  questionId INT NOT NULL,
  state ENUM("selection_option", "selected", "played") DEFAULT "selection_option",
  PRIMARY KEY (roomId, questionId),
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
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

CREATE TABLE `questionSuggestions` (
  id INT NOT NULL AUTO_INCREMENT,
  question VARCHAR(160) NOT NULL,
  userId INT NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE `roomUsers` (
  userId INT NOT NULL,
  roomId INT NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  score INT NOT NULL DEFAULT 0,
  state ENUM("idle", "selecting_question", "asking_question", "answering_question", "reading_answers", "asked_question", "winner", "asking_next", "winner_asking_next") DEFAULT "idle",
  PRIMARY KEY (userId, roomId),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
);

CREATE TABLE `answers` (
  id INT NOT NULL AUTO_INCREMENT,
  roomId INT NOT NULL,
  questionId INT NOT NULL,
  userId INT NOT NULL,
  answer VARCHAR(160) NOT NULL,
  state ENUM("submitted", "revealed", "favorite") DEFAULT "submitted",
  displayPosition INT,
  PRIMARY KEY(id),
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE `answerGuesses` (
  roomId INT NOT NULL,
  questionId INT NOT NULL,
  userId INT NOT NULL,
  guessedUserId INT NOT NULL,
  answerId INT NOT NULL,
  PRIMARY KEY(roomId, questionId, userId, guessedUserId),
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (guessedUserId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (answerId) REFERENCES answers(id) ON DELETE CASCADE
);

CREATE TABLE `favoriteAnswers` (
  roomId INT NOT NULL,
  questionId INT NOT NULL,
  userId INT NOT NULL,
  displayPosition INT NOT NULL,
  PRIMARY KEY(roomId, questionId, userId),
  FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE,
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
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