// op25_api_proxy.js
const axios = require("axios");
const config = require("./config");
const Log = require("./log");

const log = new Log("[TURNApiProxy]");

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

module.exports = { registerTurnCredentialsRoute };
