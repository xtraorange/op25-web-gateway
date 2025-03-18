// gateway_ws_proxy.js
const WebSocket = require("ws");
const Log = require("./log");
const config = require("./config");
const { handleJanusWsProxy } = require("./janus_proxy");
const { handleOp25WsBroadcast } = require("./op25_ws_proxy");

const log = new Log("[GatewayWsProxy]");

function initGatewayWsProxy(gatewayWss) {
  gatewayWss.on("connection", (clientWs, request) => {
    log.debug("Client WebSocket connected on gateway with URL:", request.url);

    if (request.url.startsWith(config.gateway_ws_janus_path)) {
      if (!config.target_janus_ws_url) {
        log.error("target_janus_ws_url not set; cannot proxy Janus.");
        clientWs.close();
        return;
      }
      handleJanusWsProxy(clientWs);
    } else if (request.url.startsWith(config.gateway_ws_op25_path)) {
      if (!config.target_op25_ws_url) {
        log.error("target_op25_ws_url not set; cannot proxy OP25.");
        clientWs.close();
        return;
      }
      handleOp25WsBroadcast(clientWs);
    } else {
      log.error("Unknown WS endpoint:", request.url);
      clientWs.close();
    }
  });
}

module.exports = { initGatewayWsProxy };
