// op25ApiProxy.js
const axios = require("axios");
const config = require("./config");

const debug = (msg) => console.debug("[OP25ApiProxy]", msg);

async function proxyRequest(req, res, endpoint) {
  try {
    const headers = {};
    if (config.OP25_API_SECRET_TOKEN) {
      headers.Authorization = config.OP25_API_SECRET_TOKEN;
      debug("Using configured OP25_API_SECRET_TOKEN for OP25 proxy");
    } else if (req.headers.authorization) {
      headers.Authorization = req.headers.authorization;
      debug("Using request's authorization header for OP25 proxy");
    }
    debug(
      `Proxying ${req.method} request to ${config.OP25_API_SERVER_URL}${endpoint}`
    );
    const response = await axios({
      method: req.method,
      url: `${config.OP25_API_SERVER_URL}${endpoint}`,
      headers,
      data: req.body,
    });
    debug(`Received response: ${JSON.stringify(response.data)}`);
    res.json(response.data);
  } catch (error) {
    console.error(
      "[OP25ApiProxy] Error:",
      error.response?.data || error.message
    );
    res.status(500).json({ error: error.response?.data || error.message });
  }
}

function registerOp25ApiRoutes(app) {
  if (!config.OP25_API_SERVER_URL) {
    debug("OP25_API_SERVER_URL not set; skipping OP25 API proxy routes.");
    return;
  }
  debug(`Enabling OP25 API proxy routes to ${config.OP25_API_SERVER_URL}`);

  // Define routes that proxy requests to the OP25 server.
  app.post("/api/op25/update", (req, res) =>
    proxyRequest(req, res, "/api/update")
  );
  app.post("/api/op25/hold", (req, res) => proxyRequest(req, res, "/api/hold"));
  app.post("/api/op25/release_hold", (req, res) =>
    proxyRequest(req, res, "/api/release_hold")
  );
  app.post("/api/op25/skip", (req, res) => proxyRequest(req, res, "/api/skip"));
  app.post("/api/op25/whitelist", (req, res) =>
    proxyRequest(req, res, "/api/whitelist")
  );
  app.get("/api/op25/whitelist", (req, res) =>
    proxyRequest(req, res, "/api/whitelist")
  );
  app.post("/api/op25/blacklist", (req, res) =>
    proxyRequest(req, res, "/api/blacklist")
  );
  app.get("/api/op25/blacklist", (req, res) =>
    proxyRequest(req, res, "/api/blacklist")
  );
  app.post("/api/op25/talkgroups", (req, res) =>
    proxyRequest(req, res, "/api/talkgroups")
  );
  app.get("/api/op25/talkgroups", (req, res) =>
    proxyRequest(req, res, "/api/talkgroups")
  );
  app.get("/api/op25/status", (req, res) =>
    proxyRequest(req, res, "/api/status")
  );
  app.get("/api/op25/logs", (req, res) => proxyRequest(req, res, "/api/logs"));
}

module.exports = { registerOp25ApiRoutes };
