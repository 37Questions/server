class MessageType {
  static Normal = "normal";
  static System = "system";
  static Chained = "chained";
}

class MessageLike {
  user_id: number;
  since: number;

  constructor(like: any) {
    this.user_id = like.user_id;
    this.since = like.since;
  }
}

class Message {
  static MIN_LENGTH = 1;
  static MAX_LENGTH = 200;

  id: number;
  created_at: number;
  user_id: number;
  body: string;

  isSystemMsg: boolean;
  isChained: boolean;

  likes: Record<number, MessageLike>;

  constructor(message: any) {
    this.id = message.id;
    this.created_at = message.created_at;
    this.user_id = message.user_id;
    this.body = message.body;
    this.isSystemMsg = message.type === "system";
    this.isChained = message.type === "chained";
    this.likes = message.likes || {};
  }
}

export {Message, MessageType, MessageLike};