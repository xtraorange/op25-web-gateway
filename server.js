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
// server.js (updated /config.js route)
app.get("/config.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );

  // Compute gateway URL from config or fallback.
  const gatewayUrl =
    config.gateway_url || `http://localhost:${config.gateway_port}`;
  // Convert http(s) to ws(s) and append the ws path.
  const wsProtocol = gatewayUrl.startsWith("https") ? "wss" : "ws";
  const gatewayWsUrl =
    wsProtocol +
    "://" +
    gatewayUrl.replace(/^https?:\/\//, "") +
    config.gateway_ws_path;
  const gatewayApiUrl = gatewayUrl + config.gateway_api_path;

  res.send(`
    window.config = {
      gateway_ws_url: ${JSON.stringify(gatewayWsUrl)},
      gateway_api_url: ${JSON.stringify(gatewayApiUrl)}
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
