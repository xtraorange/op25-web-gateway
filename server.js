// server.js
const express = require("express");
const path = require("path");
const http = require("http");
const WebSocket = require("ws");

const config = require("./config");
const Log = require("./log");
const { initGatewayWsProxy } = require("./gateway_ws_proxy");
const { registerOp25ApiRoutes } = require("./op25_api_proxy");
const { registerTurnCredentialsRoute } = require("./turn_api_proxy");

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
  const gatewayWsJanusUrl =
    wsProtocol +
    "://" +
    gatewayUrl.replace(/^https?:\/\//, "") +
    config.gateway_ws_janus_path;
  const gatewayWsOp25Url =
    wsProtocol +
    "://" +
    gatewayUrl.replace(/^https?:\/\//, "") +
    config.gateway_ws_op25_path;
  const gatewayApiUrl = gatewayUrl + config.gateway_api_path;

  res.send(`
    window.config = {
      gateway_ws_janus_url: ${JSON.stringify(gatewayWsJanusUrl)},
      gateway_ws_op25_url: ${JSON.stringify(gatewayWsOp25Url)},
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

// Create a single WebSocket.Server instance for the gateway.
const gatewayWss = new (require("ws").Server)({ noServer: true });
initGatewayWsProxy(gatewayWss);

// Upgrade handling: route based on the URL.
server.on("upgrade", (request, socket, head) => {
  const url = request.url;
  if (
    url.startsWith(config.gateway_ws_janus_path) ||
    url.startsWith(config.gateway_ws_op25_path)
  ) {
    gatewayWss.handleUpgrade(request, socket, head, (ws) => {
      gatewayWss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(config.gateway_port, () => {
  console.log(`[Server] Running on port ${config.gateway_port}`);
});
