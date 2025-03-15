// debug.js
class Log {
  constructor(tag) {
    this.tag = tag;
  }

  log(message) {
    console.log(`${this.tag} ${message}`);
  }

  debug(message) {
    console.debug(`${this.tag} ${message}`);
  }

  error(message) {
    console.error(`${this.tag} ${message}`);
  }
}

module.exports = Debug;
