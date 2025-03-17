// server.js
const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const config = require("./config");
const Log = require("./log");
const { initGatewayWsProxy } = require("./gateway_ws_proxy");
const {
  registerOp25ApiRoutes,
  registerTurnCredentialsRoute,
} = require("./op25_api_proxy");

const log = new Log("[Server]");

const app = express();
app.use(express.json());

// Serve static files from the "public" directory.
app.use(express.static(path.join(__dirname, "public")));

// Serve frontend configuration (exposing gateway endpoints)
app.get("/config.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "no-store");
  res.send(`
    window.config = {
      gateway_ws_url: ${JSON.stringify(
        (config.gateway_url || `http://localhost:${config.gateway_port}`) +
          config.gateway_ws_path
      )},
      gateway_api_url: ${JSON.stringify(
        (config.gateway_url || `http://localhost:${config.gateway_port}`) +
          config.gateway_api_path
      )},
      // You might also expose TURN server info if needed.
      turn_server_url: ${JSON.stringify(
        "turn:turn.cloudflare.com:3478?transport=udp"
      )}
    };
  `);
});

// Mount the API router at the configured gateway API path.
app.use(config.gateway_api_path, (req, res, next) => {
  // TURN credentials endpoint (if enabled)
  registerTurnCredentialsRoute(app);
  // Register OP25 API proxy routes (if target_op25_api_url is set)
  registerOp25ApiRoutes(app);
  next();
});

const server = http.createServer(app);

// Initialize the unified WebSocket proxy for the gateway.
const gatewayWss = new WebSocket.Server({ noServer: true });
initGatewayWsProxy(gatewayWss);

server.on("upgrade", (request, socket, head) => {
  if (request.url.startsWith(config.gateway_ws_path)) {
    gatewayWss.handleUpgrade(request, socket, head, (ws) => {
      gatewayWss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(config.gateway_port, () => {
  log.debug(`[Server] Running at http://localhost:${config.gateway_port}`);
});
