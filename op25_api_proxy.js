// op25_api_proxy.js
const axios = require("axios");
const config = require("./config");
const Log = require("./log");

const log = new Log("[OP25ApiProxy]");

// Shared proxy function for OP25 API requests.
async function proxyOp25Request(req, res, endpoint) {
  try {
    const headers = {};
    if (config.target_op25_api_secret_token) {
      headers.Authorization = config.target_op25_api_secret_token;
      log.debug("Using configured target_op25_api_secret_token for OP25 proxy");
    } else if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
      log.debug("Using request authorization header for OP25 proxy");
    }
    const targetUrl = config.target_op25_api_url + endpoint;
    log.debug(`Proxying ${req.method} request to ${targetUrl}`);
    const response = await axios({
      method: req.method,
      url: targetUrl,
      headers,
      data: req.body,
    });
    res.json(response.data);
  } catch (error) {
    log.error("OP25 API proxy error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data || error.message });
  }
}

function registerOp25ApiRoutes(app) {
  if (!config.target_op25_api_url) {
    log.debug("target_op25_api_url not set; skipping OP25 API proxy routes.");
    return;
  }
  log.debug(
    `Registering OP25 API proxy routes to ${config.target_op25_api_url}`
  );

  // Example routes – all mounted under /api (gateway_api_path)
  app.post("/op25/update", (req, res) =>
    proxyOp25Request(req, res, "/api/update")
  );
  app.post("/op25/hold", (req, res) => proxyOp25Request(req, res, "/api/hold"));
  app.post("/op25/release_hold", (req, res) =>
    proxyOp25Request(req, res, "/api/release_hold")
  );
  app.post("/op25/skip", (req, res) => proxyOp25Request(req, res, "/api/skip"));
  app.post("/op25/whitelist", (req, res) =>
    proxyOp25Request(req, res, "/api/whitelist")
  );
  app.get("/op25/whitelist", (req, res) =>
    proxyOp25Request(req, res, "/api/whitelist")
  );
  app.post("/op25/blacklist", (req, res) =>
    proxyOp25Request(req, res, "/api/blacklist")
  );
  app.get("/op25/blacklist", (req, res) =>
    proxyOp25Request(req, res, "/api/blacklist")
  );
  app.post("/op25/talkgroups", (req, res) =>
    proxyOp25Request(req, res, "/api/talkgroups")
  );
  app.get("/op25/talkgroups", (req, res) =>
    proxyOp25Request(req, res, "/api/talkgroups")
  );
  app.get("/op25/status", (req, res) =>
    proxyOp25Request(req, res, "/api/status")
  );
  app.get("/op25/logs", (req, res) => proxyOp25Request(req, res, "/api/logs"));
}

// TURN credentials endpoint (if configured)
function registerTurnCredentialsRoute(app) {
  if (config.target_turn_key_id && config.target_turn_api_token) {
    app.get("/turn-credentials", async (req, res) => {
      const url = `https://rtc.live.cloudflare.com/v1/turn/keys/${config.target_turn_key_id}/credentials/generate`;
      try {
        const response = await axios.post(
          url,
          {
            ttl: config.target_turn_credential_ttl,
            customIdentifier: config.target_turn_custom_identifier,
          },
          {
            headers: {
              Authorization: `Bearer ${config.target_turn_api_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        res.json(response.data);
      } catch (error) {
        log.error(
          "Error generating TURN credentials:",
          error.response?.data || error.message
        );
        res.status(500).json({ error: "Unable to generate TURN credentials" });
      }
    });
  } else {
    log.debug(
      "TURN credentials endpoint disabled due to missing configuration."
    );
  }
}

module.exports = { registerOp25ApiRoutes, registerTurnCredentialsRoute };
