// op25WsProxy.js
const WebSocket = require("ws");
const config = require("./config");

const debug = (msg) => console.debug("[OP25WsProxy]", msg);

let op25Wss = null;

function initOp25WsProxy() {
  if (!config.OP25_API_WS_URL) {
    debug("OP25_API_WS_URL not set; OP25 WebSocket proxy disabled.");
    return null;
  }
  debug(`Enabling OP25 WS proxy to ${config.OP25_API_WS_URL}`);
  op25Wss = new WebSocket.Server({ noServer: true });

  op25Wss.on("connection", (ws) => {
    debug("OP25 WebSocket client connected");

    const op25Client = new WebSocket(config.OP25_API_WS_URL);

    op25Client.on("open", () => {
      debug("Connected to OP25 WS endpoint");
      ws.send(JSON.stringify({ event: "op25_ws_connected" }));
    });

    op25Client.on("message", (data) => {
      ws.send(data);
    });

    ws.on("message", (message) => {
      op25Client.send(message);
    });

    ws.on("close", () => {
      op25Client.close();
      debug("Client WebSocket closed; closing OP25 WS connection.");
    });

    op25Client.on("close", () => {
      ws.close();
      debug("OP25 WS connection closed; closing client socket.");
    });

    op25Client.on("error", (err) => {
      console.error("[OP25WsProxy] Error on OP25 WS client:", err.message);
    });
  });

  return op25Wss;
}

function registerUpgradeHandler(server) {
  if (!config.OP25_API_WS_URL) {
    debug("OP25_API_WS_URL not set; skipping upgrade handling for OP25 WS.");
    return;
  }
  server.on("upgrade", (request, socket, head) => {
    if (request.url.startsWith("/op25ws")) {
      op25Wss.handleUpgrade(request, socket, head, (ws) => {
        debug("Upgraded connection on /op25ws");
        op25Wss.emit("connection", ws, request);
      });
    }
  });
}

module.exports = { initOp25WsProxy, registerUpgradeHandler };
