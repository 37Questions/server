/*******************
 * Data Validation *
 *******************/

class Validation {

  static hash(hash: any, length: number): boolean {
    return typeof hash === "string" && hash.length === length;
  }

  static uint(uint: any): boolean {
    return typeof uint === "number" && uint % 1 === 0 && uint >= 0;
  }

  static boolean(boolean: any): boolean {
    return typeof boolean === "boolean";
  }

  static object(object: any): boolean {
    return typeof object === "object";
  }

  static string(string: any): boolean {
    return typeof string === "string" && string.length > 0;
  }

}

/*******************
 * General Helpers *
 *******************/

class Util {
  // generate a random hash
  static makeHash(length: number) {
    let result = "";
    let hexChars = "0123456789abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < length; i += 1) {
      result += hexChars[Math.floor(Math.random() * hexChars.length)];
    }
    return result;
  }

  // Replace </> characters with 'safe' encoded counterparts
  static stripHTML(string: string) {
    return string.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}

/*************
 * Constants *
 *************/

// A selection of Font Awesome icons suitable for profile pictures
const Icons: Array<string> = [
  "apple-alt",  "candy-cane", "carrot", "cat", "cheese", "cookie", "crow", "dog", "dove", "dragon", "egg", "fish",
  "frog", "hamburger", "hippo", "horse", "hotdog", "ice-cream", "kiwi-bird", "leaf", "lemon", "otter", "paw",
  "pepper-hot", "pizza-slice", "spider", "holly-berry", "bat", "deer", "duck", "elephant", "monkey", "narwhal",
  "pig", "rabbit", "sheep", "squirrel", "turtle", "whale", "salad", "pumpkin", "wheat", "burrito", "cheese-swiss",
  "croissant", "drumstick", "egg-fried", "french-fries", "gingerbread-man", "hat-chef", "meat", "pie", "popcorn",
  "sausage", "steak", "taco", "turkey"
];

export {Validation, Util, Icons};
