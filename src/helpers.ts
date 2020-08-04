class Validation {
  /*******************
   * Data Validation *
   *******************/

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

  /*******************
   * General Helpers *
   *******************/
}

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

export {Validation, Util};
