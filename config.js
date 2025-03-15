// config.js
const dotenv = require("dotenv");
dotenv.config();

const debug = (msg) => console.debug("[CONFIG]", msg);

const isSet = (envVar) => envVar && envVar.trim().length > 0;

const config = {
  // General Server Configuration
  PORT: process.env.PORT || 3000,
  WS_URL: process.env.WS_URL && process.env.WS_URL.trim(),

  // Janus Proxy Configuration
  JANUS_WS_URL: process.env.JANUS_WS_URL && process.env.JANUS_WS_URL.trim(),
  JANUS_API_SECRET:
    process.env.JANUS_API_SECRET && process.env.JANUS_API_SECRET.trim(),

  // TURN / Cloudflare Configuration
  CLOUDFLARE_TURN_KEY_ID: process.env.CLOUDFLARE_TURN_KEY_ID,
  CLOUDFLARE_TURN_API_TOKEN: process.env.CLOUDFLARE_TURN_API_TOKEN,
  CLOUDFLARE_TURN_CREDENTIAL_TTL:
    process.env.CLOUDFLARE_TURN_CREDENTIAL_TTL || 86400,
  CLOUDFLARE_TURN_CUSTOM_IDENTIFIER:
    process.env.CLOUDFLARE_TURN_CUSTOM_IDENTIFIER || "op25_web_gateway",

  // OP25 Proxy Configuration
  OP25_API_SERVER_URL:
    process.env.OP25_API_SERVER_URL && process.env.OP25_API_SERVER_URL.trim(),
  OP25_API_WS_URL:
    process.env.OP25_API_WS_URL && process.env.OP25_API_WS_URL.trim(),
  OP25_API_SECRET_TOKEN:
    process.env.OP25_API_SECRET_TOKEN &&
    process.env.OP25_API_SECRET_TOKEN.trim(),
};

debug(`PORT: ${config.PORT}`);
debug(`WS_URL: ${config.WS_URL || "not set"}`);

debug(`JANUS_WS_URL: ${config.JANUS_WS_URL || "not set"}`);
debug(
  `JANUS_API_SECRET: ${config.JANUS_API_SECRET ? "[REDACTED]" : "not set"}`
);

if (
  isSet(config.CLOUDFLARE_TURN_KEY_ID) &&
  isSet(config.CLOUDFLARE_TURN_API_TOKEN)
) {
  debug("TURN credentials enabled.");
} else {
  debug("TURN credentials disabled.");
}

debug(`OP25_API_SERVER_URL: ${config.OP25_API_SERVER_URL || "not set"}`);
debug(`OP25_API_WS_URL: ${config.OP25_API_WS_URL || "not set"}`);
debug(
  `OP25_API_SECRET_TOKEN: ${
    config.OP25_API_SECRET_TOKEN ? "[REDACTED]" : "not set"
  }`
);

module.exports = config;
