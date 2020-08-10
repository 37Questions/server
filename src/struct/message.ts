class Message {
  static MIN_LENGTH = 1;
  static MAX_LENGTH = 200;

  id: number;
  created_at: number;
  user_id: number;
  room_id: number;
  body: string;
  isSystemMsg: boolean;

  constructor(message: Message) {
    this.id = message.id;
    this.created_at = message.created_at;
    this.user_id = message.user_id;
    this.room_id = message.room_id;
    this.body = message.body;
    this.isSystemMsg = message.isSystemMsg;
  }
}

export default Message;