// op25_ws_proxy.js
const WebSocket = require("ws");
const config = require("./config");
const Log = require("./log");

const log = new Log("[OP25WsProxy]");

// Global variables for the single target connection and list of subscribed clients.
let globalOp25Ws = null;
const subscribedClients = new Set();

function initGlobalOp25Connection() {
  if (!config.target_op25_ws_url) {
    log.error(
      "target_op25_ws_url not set; cannot establish OP25 global WS connection."
    );
    return;
  }

  log.debug(
    `Establishing global OP25 WS connection to ${config.target_op25_ws_url}`
  );
  globalOp25Ws = new WebSocket(config.target_op25_ws_url);

  globalOp25Ws.on("open", () => {
    log.debug("Global OP25 WS connection established.");
    // Optionally, inform subscribed clients of the connection.
    broadcast({ event: "op25_ws_connected" });
  });

  globalOp25Ws.on("message", (data) => {
    log.debug("Received message from OP25 target:", data);
    // Broadcast the update to all subscribed clients.
    broadcast(data);
  });

  globalOp25Ws.on("close", () => {
    log.debug("Global OP25 WS connection closed.");
    globalOp25Ws = null;
    // Inform clients if needed.
    broadcast({ event: "op25_ws_disconnected" });
    // Optionally, try to reconnect after a delay.
    setTimeout(initGlobalOp25Connection, 2000);
  });

  globalOp25Ws.on("error", (err) => {
    log.error("Error on global OP25 WS connection:", err.message);
    globalOp25Ws.close();
  });
}

function broadcast(message) {
  // If message is an object, convert it to a JSON string.
  const data = typeof message === "string" ? message : JSON.stringify(message);
  for (const client of subscribedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}

/**
 * Subscribes a client WebSocket to the global OP25 connection.
 * The client's messages are forwarded to the target connection,
 * and any messages received from the target are broadcast to all subscribers.
 */
function handleOp25WsBroadcast(clientWs) {
  // Add the client to our subscribers.
  subscribedClients.add(clientWs);
  log.debug(
    "Client subscribed to OP25 broadcast. Total subscribers:",
    subscribedClients.size
  );

  // If the global connection is not yet established, initialize it.
  if (!globalOp25Ws) {
    initGlobalOp25Connection();
  }

  // Forward any messages received from the client to the global OP25 WS.
  clientWs.on("message", (message) => {
    if (globalOp25Ws && globalOp25Ws.readyState === WebSocket.OPEN) {
      log.debug("Forwarding client message to OP25 target:", message);
      globalOp25Ws.send(message);
    }
  });

  // When the client disconnects, remove it from subscribers.
  clientWs.on("close", () => {
    subscribedClients.delete(clientWs);
    log.debug(
      "Client unsubscribed from OP25 broadcast. Remaining subscribers:",
      subscribedClients.size
    );
  });

  clientWs.on("error", () => {
    subscribedClients.delete(clientWs);
    log.debug(
      "Client error - unsubscribed from OP25 broadcast. Remaining subscribers:",
      subscribedClients.size
    );
  });
}

module.exports = { handleOp25WsBroadcast };
