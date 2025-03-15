// janusProxy.js
const WebSocket = require("ws");
const config = require("./config");

const Log = require("./log");

const log = new Log("[JanusProxy]");

let janusWss = null;

function initJanusProxy(app) {
  if (!config.JANUS_WS_URL) {
    log.debug("JANUS_WS_URL not set; Janus proxy disabled.");
    return;
  }

  log.debug(`Enabling Janus proxy using URL: ${config.JANUS_WS_URL}`);
  janusWss = new WebSocket.Server({ noServer: true });

  janusWss.on("connection", (ws) => {
    log.debug("Janus WebSocket client connected");
    let sessionId = null;
    let handleId = null;
    let keepaliveInterval = null;

    const janusWs = new WebSocket(config.JANUS_WS_URL, ["janus-protocol"]);

    janusWs.on("open", () => {
      log.debug("Connected to Janus via WebSocket");
      const createSessionMsg = {
        janus: "create",
        transaction: "txn_create_session",
        apisecret: config.JANUS_API_SECRET || undefined,
      };
      log.debug(
        "Sending create session message:",
        JSON.stringify(createSessionMsg)
      );
      janusWs.send(JSON.stringify(createSessionMsg));
    });

    janusWs.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        log.debug(`Received message: ${JSON.stringify(message)}`);

        if (
          message.janus === "success" &&
          message.transaction === "txn_create_session"
        ) {
          sessionId = message.data.id;
          log.debug(`Created Janus session: ${sessionId}`);

          keepaliveInterval = setInterval(() => {
            if (janusWs.readyState === WebSocket.OPEN && sessionId) {
              const keepaliveMsg = {
                janus: "keepalive",
                session_id: sessionId,
                transaction: `txn_keepalive_${Date.now()}`,
                apisecret: config.JANUS_API_SECRET || undefined,
              };
              janusWs.send(JSON.stringify(keepaliveMsg));
              log.debug(`Sent keepalive for session ${sessionId}`);
            }
          }, 30000);

          const attachMsg = {
            janus: "attach",
            session_id: sessionId,
            plugin: "janus.plugin.streaming",
            transaction: "txn_attach_streaming",
            apisecret: config.JANUS_API_SECRET || undefined,
          };
          log.debug(`Sending attach message: ${JSON.stringify(attachMsg)}`);
          janusWs.send(JSON.stringify(attachMsg));
          return;
        }

        if (
          message.janus === "success" &&
          message.transaction === "txn_attach_streaming"
        ) {
          handleId = message.data.id;
          log.debug(`Attached to Streaming Plugin: ${handleId}`);
          ws.send(
            JSON.stringify({ event: "janus_session", sessionId, handleId })
          );

          const listMsg = {
            janus: "message",
            session_id: sessionId,
            handle_id: handleId,
            body: { request: "list" },
            transaction: "txn_list_streams",
            apisecret: config.JANUS_API_SECRET || undefined,
          };
          log.debug(`Requesting stream list: ${JSON.stringify(listMsg)}`);
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
          log.debug(`Received streams list: ${JSON.stringify(streams)}`);
          ws.send(JSON.stringify({ event: "streams", streams }));
          return;
        }

        ws.send(JSON.stringify(message));
      } catch (err) {
        console.error("[JanusProxy] Error processing message:", err.message);
      }
    });

    janusWs.on("close", () => {
      log.debug("Janus WebSocket connection closed");
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    });

    janusWs.on("error", (err) => {
      console.error("[JanusProxy] Janus WebSocket error:", err.message);
    });

    ws.on("message", (message) => {
      try {
        const clientMsg = JSON.parse(message);
        log.debug(`Received from frontend: ${JSON.stringify(clientMsg)}`);

        if (
          clientMsg.janus === "message" &&
          clientMsg.body.request === "watch"
        ) {
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
            apisecret: config.JANUS_API_SECRET || undefined,
          };
          janusWs.send(JSON.stringify(watchMsg));
          log.debug(`Sent watch message: ${JSON.stringify(watchMsg)}`);
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
            apisecret: config.JANUS_API_SECRET || undefined,
          };
          janusWs.send(JSON.stringify(startMsg));
          log.debug(`Sent start message: ${JSON.stringify(startMsg)}`);
        } else if (clientMsg.janus === "trickle") {
          const trickleMsg = {
            janus: "trickle",
            session_id: sessionId,
            handle_id: handleId,
            candidate: clientMsg.candidate,
            transaction: `txn_trickle_${Date.now()}`,
            apisecret: config.JANUS_API_SECRET || undefined,
          };
          janusWs.send(JSON.stringify(trickleMsg));
          log.debug(`Sent trickle message: ${JSON.stringify(trickleMsg)}`);
        }
      } catch (err) {
        console.error(
          "[JanusProxy] Error processing frontend message:",
          err.message
        );
      }
    });

    ws.on("close", () => {
      log.debug("Janus WebSocket client disconnected");
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      if (janusWs && janusWs.readyState === WebSocket.OPEN) {
        const destroyMsg = {
          janus: "destroy",
          transaction: "txn_destroy_session",
          apisecret: config.JANUS_API_SECRET || undefined,
          session_id: sessionId,
        };
        janusWs.send(JSON.stringify(destroyMsg));
        log.debug(`Sent destroy message for session ${sessionId}`);
      }
    });
  });
}

module.exports = {
  initJanusProxy: (server) => {
    // This function sets up upgrade handling for Janus if a server exists.
    if (janusWss) {
      server.on("upgrade", (request, socket, head) => {
        if (request.url.startsWith("/janus")) {
          janusWss.handleUpgrade(request, socket, head, (ws) => {
            console.log.debug("[JanusProxy] Upgraded connection on /janus");
            janusWss.emit("connection", ws, request);
          });
        }
      });
      log.debug("Janus WebSocket upgrade handling installed.");
    }
  },
};
