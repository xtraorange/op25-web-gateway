// janus_proxy.js
const WebSocket = require("ws");
const config = require("./config");
const Log = require("./log");

const log = new Log("[JanusProxy]");

function handleJanusWsProxy(clientWs) {
  // Create a connection to the target Janus server.
  const janusWs = new WebSocket(config.target_janus_ws_url, ["janus-protocol"]);
  let sessionId = null;
  let handleId = null;
  let keepaliveInterval = null;

  janusWs.on("open", () => {
    log.debug("Connected to target Janus server");
    // Create session message.
    const createSessionMsg = {
      janus: "create",
      transaction: "txn_create_session",
      apisecret: config.target_janus_api_secret || undefined,
    };
    log.debug("Sending create session message:", createSessionMsg);
    janusWs.send(JSON.stringify(createSessionMsg));
  });

  janusWs.on("message", (data) => {
    try {
      const message = JSON.parse(data);
      log.debug("Received from Janus target:", message);

      // Handle session creation.
      if (
        message.janus === "success" &&
        message.transaction === "txn_create_session"
      ) {
        sessionId = message.data.id;
        log.debug("Created Janus session:", sessionId);

        // Set up a keepalive.
        keepaliveInterval = setInterval(() => {
          if (janusWs.readyState === WebSocket.OPEN && sessionId) {
            const keepaliveMsg = {
              janus: "keepalive",
              session_id: sessionId,
              transaction: `txn_keepalive_${Date.now()}`,
              apisecret: config.target_janus_api_secret || undefined,
            };
            janusWs.send(JSON.stringify(keepaliveMsg));
            log.debug(`Sent keepalive for session ${sessionId}`);
          }
        }, 30000);

        // Attach to the streaming plugin.
        const attachMsg = {
          janus: "attach",
          session_id: sessionId,
          plugin: "janus.plugin.streaming",
          transaction: "txn_attach_streaming",
          apisecret: config.target_janus_api_secret || undefined,
        };
        log.debug("Sending attach message:", attachMsg);
        janusWs.send(JSON.stringify(attachMsg));
        return;
      }

      // Handle plugin attachment.
      if (
        message.janus === "success" &&
        message.transaction === "txn_attach_streaming"
      ) {
        handleId = message.data.id;
        log.debug("Attached to Janus streaming plugin:", handleId);
        // Inform the client.
        clientWs.send(
          JSON.stringify({ event: "janus_session", sessionId, handleId })
        );
        // Request stream list.
        const listMsg = {
          janus: "message",
          session_id: sessionId,
          handle_id: handleId,
          body: { request: "list" },
          transaction: "txn_list_streams",
          apisecret: config.target_janus_api_secret || undefined,
        };
        log.debug("Requesting stream list:", listMsg);
        janusWs.send(JSON.stringify(listMsg));
        return;
      }

      if (
        message.janus === "success" &&
        message.transaction === "txn_list_streams"
      ) {
        const streams =
          (message.plugindata &&
            message.plugindata.data &&
            message.plugindata.data.list) ||
          [];
        log.debug("Received streams list:", streams);
        clientWs.send(JSON.stringify({ event: "streams", streams }));
        return;
      }

      // For all other messages, pass them along.
      clientWs.send(JSON.stringify(message));
    } catch (err) {
      log.error("Error processing message from target Janus:", err.message);
    }
  });

  janusWs.on("close", () => {
    log.debug("Connection to target Janus closed");
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    clientWs.close();
  });

  janusWs.on("error", (err) => {
    log.error("Target Janus WebSocket error:", err.message);
    clientWs.close();
  });

  // Forward messages from the client to the target Janus.
  clientWs.on("message", (message) => {
    try {
      const clientMsg = JSON.parse(message);
      log.debug("Received from client:", clientMsg);

      // Forward specific commands (watch, start, trickle, etc.) as needed.
      if (clientMsg.janus === "message" && clientMsg.body.request === "watch") {
        const watchMsg = {
          janus: "message",
          session_id: sessionId,
          handle_id: handleId,
          body: {
            request: "watch",
            id: clientMsg.body.id,
            audio: true,
            video: false,
          },
          transaction: `txn_watch_${Date.now()}`,
          apisecret: config.target_janus_api_secret || undefined,
        };
        janusWs.send(JSON.stringify(watchMsg));
        log.debug("Sent watch message:", watchMsg);
      } else if (
        clientMsg.janus === "message" &&
        clientMsg.body.request === "start"
      ) {
        const startMsg = {
          janus: "message",
          session_id: sessionId,
          handle_id: handleId,
          body: { request: "start" },
          jsep: clientMsg.jsep,
          transaction: `txn_start_${Date.now()}`,
          apisecret: config.target_janus_api_secret || undefined,
        };
        janusWs.send(JSON.stringify(startMsg));
        log.debug("Sent start message:", startMsg);
      } else if (clientMsg.janus === "trickle") {
        const trickleMsg = {
          janus: "trickle",
          session_id: sessionId,
          handle_id: handleId,
          candidate: clientMsg.candidate,
          transaction: `txn_trickle_${Date.now()}`,
          apisecret: config.target_janus_api_secret || undefined,
        };
        janusWs.send(JSON.stringify(trickleMsg));
        log.debug("Sent trickle message:", trickleMsg);
      }
    } catch (err) {
      log.error("Error processing message from client:", err.message);
    }
  });

  clientWs.on("close", () => {
    log.debug("Client disconnected from Janus proxy");
    if (keepaliveInterval) clearInterval(keepaliveInterval);
    if (janusWs.readyState === WebSocket.OPEN) {
      const destroyMsg = {
        janus: "destroy",
        transaction: "txn_destroy_session",
        apisecret: config.target_janus_api_secret || undefined,
        session_id: sessionId,
      };
      janusWs.send(JSON.stringify(destroyMsg));
      log.debug("Sent destroy message:", destroyMsg);
    }
  });
}

module.exports = { handleJanusWsProxy };
