// gateway_ws_proxy.js
const WebSocket = require("ws");
const Log = require("./log");
const config = require("./config");
const { handleJanusWsProxy } = require("./janus_proxy");
const { handleOp25WsProxy } = require("./op25_ws_proxy");

const log = new Log("[GatewayWsProxy]");

function initGatewayWsProxy(gatewayWss) {
  gatewayWss.on("connection", (clientWs, request) => {
    log.debug("Client WebSocket connected on gateway");

    // Wait for the first message that should indicate which service to use.
    clientWs.once("message", (message) => {
      let initMsg;
      try {
        initMsg = JSON.parse(message);
      } catch (err) {
        log.error("Invalid JSON in initial message", err);
        clientWs.close();
        return;
      }

      if (!initMsg.service) {
        log.error("Initial message missing 'service' field");
        clientWs.close();
        return;
      }

      // Route to the appropriate target based on the service requested.
      if (initMsg.service === "janus") {
        if (!config.target_janus_ws_url) {
          log.error("target_janus_ws_url not set; cannot proxy Janus.");
          clientWs.close();
          return;
        }
        handleJanusWsProxy(clientWs);
      } else if (initMsg.service === "op25") {
        if (!config.target_op25_ws_url) {
          log.error("target_op25_ws_url not set; cannot proxy OP25.");
          clientWs.close();
          return;
        }
        handleOp25WsProxy(clientWs);
      } else {
        log.error("Unknown service requested:", initMsg.service);
        clientWs.close();
      }
    });
  });
}

module.exports = { initGatewayWsProxy };
