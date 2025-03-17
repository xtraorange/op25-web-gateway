// op25_ws_proxy.js
const WebSocket = require("ws");
const config = require("./config");
const Log = require("./log");

const log = new Log("[OP25WsProxy]");

function handleOp25WsProxy(clientWs) {
  const op25Ws = new WebSocket(config.target_op25_ws_url);

  op25Ws.on("open", () => {
    log.debug("Connected to target OP25 WS endpoint");
    clientWs.send(JSON.stringify({ event: "op25_ws_connected" }));
  });

  op25Ws.on("message", (data) => {
    clientWs.send(data);
  });

  clientWs.on("message", (message) => {
    op25Ws.send(message);
  });

  clientWs.on("close", () => {
    op25Ws.close();
    log.debug("Client WS closed; closing target OP25 connection.");
  });

  op25Ws.on("close", () => {
    clientWs.close();
    log.debug("Target OP25 connection closed; closing client WS.");
  });

  op25Ws.on("error", (err) => {
    log.error("Error on target OP25 WS:", err.message);
    clientWs.close();
  });
}

module.exports = { handleOp25WsProxy };
