// server.js
const express = require("express");
const path = require("path");
const { exec } = require("child_process");
const fs = require("fs");
const http = require("http");
const WebSocket = require("ws");
const axios = require("axios");

const config = require("./config");
const { registerOp25ApiRoutes } = require("./op25_api_proxy.js");
const {
  initOp25WsProxy,
  registerUpgradeHandler,
} = require("./op25_ws_proxy.js");
const { initJanusProxy } = require("./janus_proxy.js");

const Log = require("./log");

const log = new Log("[Server]");

const app = express();
app.use(express.json());

// Serve static files from the "public" directory.
app.use(express.static(path.join(__dirname, "public")));

// Serve frontend configuration.
app.get("/config.js", (req, res) => {
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.send(`
    window.config = {
      WS_URL: ${JSON.stringify(config.WS_URL || null)},
      TURN_SERVER_URL: ${JSON.stringify(
        "turn:turn.cloudflare.com:3478?transport=udp"
      )}
    };
  `);
});

// ----- Register TURN Credentials Endpoint (if TURN config exists) -----
if (config.CLOUDFLARE_TURN_KEY_ID && config.CLOUDFLARE_TURN_API_TOKEN) {
  app.get("/api/turn-credentials", async (req, res) => {
    const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${config.CLOUDFLARE_TURN_KEY_ID}/credentials/generate`;
    try {
      const response = await axios.post(
        url,
        {
          ttl: config.CLOUDFLARE_TURN_CREDENTIAL_TTL,
          customIdentifier: config.CLOUDFLARE_TURN_CUSTOM_IDENTIFIER,
        },
        {
          headers: {
            Authorization: `Bearer ${config.CLOUDFLARE_TURN_API_TOKEN}`,
            "Content-Type": "application/json",
          },
        }
      );
      res.json(response.data);
    } catch (error) {
      log.error(
        "[Server] Error generating TURN credentials:",
        error.response?.data || error.message
      );
      res.status(500).json({ error: "Unable to generate TURN credentials" });
    }
  });
} else {
  log.debug(
    "[Server] TURN credentials endpoint disabled due to missing configuration."
  );
}

// ----- Register OP25 API Proxy Routes (if OP25_API_SERVER_URL is set) -----
if (config.OP25_API_SERVER_URL) {
  log.debug(
    "[Server] OP25_API_SERVER_URL is set; registering OP25 API proxy routes."
  );
  registerOp25ApiRoutes(app);
} else {
  log.debug(
    "[Server] OP25_API_SERVER_URL not set; OP25 API proxy routes disabled."
  );
}

// ----- Initialize Janus Proxy (if JANUS_WS_URL is set) -----
if (config.JANUS_WS_URL) {
  log.debug("[Server] JANUS_WS_URL is set; initializing Janus proxy.");
  // Register upgrade handling for Janus proxy.
  const janusProxy = require("./janus_proxy");
  janusProxy.initJanusProxy(server);
} else {
  log.debug("[Server] JANUS_WS_URL not set; Janus proxy disabled.");
}

// ----- Initialize OP25 WebSocket Proxy (if OP25_API_WS_URL is set) -----
let op25Wss = null;
if (config.OP25_API_WS_URL) {
  log.debug(
    "[Server] OP25_API_WS_URL is set; initializing OP25 WebSocket proxy."
  );
  op25Wss = initOp25WsProxy();
} else {
  log.debug("[Server] OP25_API_WS_URL not set; OP25 WebSocket proxy disabled.");
}

// Create the HTTP server so that we can handle WebSocket upgrades.
const server = http.createServer(app);

if (op25Wss) {
  registerUpgradeHandler(server);
}

// Combined upgrade handling for Janus proxy is handled in janusProxy.js
// (See that module for its upgrade handler registration.)

server.listen(config.PORT, () => {
  log.debug(`[Server] Server running at http://localhost:${config.PORT}`);
});
