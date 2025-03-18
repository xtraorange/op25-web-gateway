// op25.js
export default class Op25Client {
  constructor({ wsUrl } = {}) {
    if (!wsUrl) {
      throw new Error("A wsUrl for OP25 is required.");
    }
    this.wsUrl = wsUrl;
    this.ws = null;
    this.callbacks = [];
  }

  initWebSocket() {
    console.log("Creating OP25 WebSocket connection to:", this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onopen = () => {
      console.log("OP25 WS connected");
      // Identify the service.
      this.ws.send(JSON.stringify({ service: "op25" }));
    };
    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (err) {
        console.error("Error parsing OP25 message:", err);
        return;
      }
      this.callbacks.forEach((cb) => cb(msg));
    };
    this.ws.onclose = () => {
      console.warn("OP25 WS connection closed");
      // Optionally, reconnect.
      setTimeout(() => this.initWebSocket(), 2000);
    };
    this.ws.onerror = (err) => console.error("OP25 WS error:", err);
  }

  onMessage(callback) {
    this.callbacks.push(callback);
  }

  send(message) {
    // Attach service field if not present.
    const msg =
      typeof message === "object" ? { ...message, service: "op25" } : message;
    this.ws.send(JSON.stringify(msg));
  }
}
