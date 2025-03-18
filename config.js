// config.js
const dotenv = require("dotenv");
dotenv.config();

const debug = (msg) => console.debug("[CONFIG]", msg);

const isSet = (envVar) => envVar && envVar.trim().length > 0;

const config = {
  // Gateway (client-facing) configuration.
  gateway_port: process.env.GATEWAY_PORT || 3000,
  // For now, we assume the gateway URL is constructed from the host/port of this server.
  gateway_ws_janus_path: process.env.GATEWAY_WS_JANUS_PATH || "/ws/janus",
  gateway_ws_op25_path: process.env.GATEWAY_WS_OP25_PATH || "/ws/op25",
  gateway_api_path: process.env.GATEWAY_API_PATH || "/api",
  // Exposed to the frontend.
  gateway_url: process.env.GATEWAY_URL || null,

  // Target (backend) configuration.
  target_janus_ws_url:
    process.env.TARGET_JANUS_WS_URL && process.env.TARGET_JANUS_WS_URL.trim(),
  target_op25_api_url:
    process.env.TARGET_OP25_API_URL && process.env.TARGET_OP25_API_URL.trim(),
  target_op25_ws_url:
    process.env.TARGET_OP25_WS_URL && process.env.TARGET_OP25_WS_URL.trim(),

  // Optional shared secrets/tokens for target connections.
  target_janus_api_secret:
    process.env.TARGET_JANUS_API_SECRET &&
    process.env.TARGET_JANUS_API_SECRET.trim(),
  target_op25_api_secret_token:
    process.env.TARGET_OP25_API_SECRET_TOKEN &&
    process.env.TARGET_OP25_API_SECRET_TOKEN.trim(),

  // TURN / Cloudflare Configuration (for Janus target)
  target_turn_key_id: process.env.TARGET_TURN_KEY_ID,
  target_turn_api_token: process.env.TARGET_TURN_API_TOKEN,
  target_turn_credential_ttl: process.env.TARGET_TURN_CREDENTIAL_TTL || 86400,
  target_turn_custom_identifier:
    process.env.TARGET_TURN_CUSTOM_IDENTIFIER || "op25_web_gateway",
};

debug(`gateway_port: ${config.gateway_port}`);
debug(`gateway_ws_path: ${config.gateway_ws_path}`);
debug(`gateway_api_path: ${config.gateway_api_path}`);
debug(`gateway_url: ${config.gateway_url || "not set"}`);

debug(`target_janus_ws_url: ${config.target_janus_ws_url || "not set"}`);
debug(`target_op25_api_url: ${config.target_op25_api_url || "not set"}`);
debug(`target_op25_ws_url: ${config.target_op25_ws_url || "not set"}`);

if (isSet(config.target_turn_key_id) && isSet(config.target_turn_api_token)) {
  debug("TURN credentials enabled.");
} else {
  debug("TURN credentials disabled.");
}

module.exports = config;
