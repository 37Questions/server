class MessageType {
  static Normal = "normal";
  static System = "system";
  static Chained = "chained";
}

class MessageLike {
  userId: number;
  since: number;

  constructor(like: MessageLike) {
    this.userId = like.userId;
    this.since = like.since;
  }
}

class Message {
  static MIN_LENGTH = 1;
  static MAX_LENGTH = 200;

  id: number;
  createdAt: number;
  userId: number;
  body: string;

  isSystemMsg: boolean;
  isChained: boolean;

  likes: Record<number, MessageLike>;

  constructor(message: any) {
    this.id = message.id;
    this.createdAt = message.createdAt;
    this.userId = message.userId;
    this.body = message.body;
    this.isSystemMsg = message.type === "system";
    this.isChained = message.type === "chained";
    this.likes = message.likes || {};
  }
}

export {Message, MessageType, MessageLike};