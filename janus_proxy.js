// janusProxy.js
const WebSocket = require("ws");
const config = require("./config");

const debug = (msg) => console.debug("[JanusProxy]", msg);

let janusWss = null;

function initJanusProxy(app) {
  if (!config.JANUS_WS_URL) {
    debug("JANUS_WS_URL not set; Janus proxy disabled.");
    return;
  }

  debug(`Enabling Janus proxy using URL: ${config.JANUS_WS_URL}`);
  janusWss = new WebSocket.Server({ noServer: true });

  janusWss.on("connection", (ws) => {
    debug("Janus WebSocket client connected");
    let sessionId = null;
    let handleId = null;
    let keepaliveInterval = null;

    const janusWs = new WebSocket(config.JANUS_WS_URL, ["janus-protocol"]);

    janusWs.on("open", () => {
      debug("Connected to Janus via WebSocket");
      const createSessionMsg = {
        janus: "create",
        transaction: "txn_create_session",
        apisecret: config.JANUS_API_SECRET || undefined,
      };
      debug(
        "Sending create session message:",
        JSON.stringify(createSessionMsg)
      );
      janusWs.send(JSON.stringify(createSessionMsg));
    });

    janusWs.on("message", (data) => {
      try {
        const message = JSON.parse(data);
        debug(`Received message: ${JSON.stringify(message)}`);

        if (
          message.janus === "success" &&
          message.transaction === "txn_create_session"
        ) {
          sessionId = message.data.id;
          debug(`Created Janus session: ${sessionId}`);

          keepaliveInterval = setInterval(() => {
            if (janusWs.readyState === WebSocket.OPEN && sessionId) {
              const keepaliveMsg = {
                janus: "keepalive",
                session_id: sessionId,
                transaction: `txn_keepalive_${Date.now()}`,
                apisecret: config.JANUS_API_SECRET || undefined,
              };
              janusWs.send(JSON.stringify(keepaliveMsg));
              debug(`Sent keepalive for session ${sessionId}`);
            }
          }, 30000);

          const attachMsg = {
            janus: "attach",
            session_id: sessionId,
            plugin: "janus.plugin.streaming",
            transaction: "txn_attach_streaming",
            apisecret: config.JANUS_API_SECRET || undefined,
          };
          debug(`Sending attach message: ${JSON.stringify(attachMsg)}`);
          janusWs.send(JSON.stringify(attachMsg));
          return;
        }

        if (
          message.janus === "success" &&
          message.transaction === "txn_attach_streaming"
        ) {
          handleId = message.data.id;
          debug(`Attached to Streaming Plugin: ${handleId}`);
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
          debug(`Requesting stream list: ${JSON.stringify(listMsg)}`);
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
          debug(`Received streams list: ${JSON.stringify(streams)}`);
          ws.send(JSON.stringify({ event: "streams", streams }));
          return;
        }

        ws.send(JSON.stringify(message));
      } catch (err) {
        console.error("[JanusProxy] Error processing message:", err.message);
      }
    });

    janusWs.on("close", () => {
      debug("Janus WebSocket connection closed");
      if (keepaliveInterval) clearInterval(keepaliveInterval);
    });

    janusWs.on("error", (err) => {
      console.error("[JanusProxy] Janus WebSocket error:", err.message);
    });

    ws.on("message", (message) => {
      try {
        const clientMsg = JSON.parse(message);
        debug(`Received from frontend: ${JSON.stringify(clientMsg)}`);

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
          debug(`Sent watch message: ${JSON.stringify(watchMsg)}`);
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
          debug(`Sent start message: ${JSON.stringify(startMsg)}`);
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
          debug(`Sent trickle message: ${JSON.stringify(trickleMsg)}`);
        }
      } catch (err) {
        console.error(
          "[JanusProxy] Error processing frontend message:",
          err.message
        );
      }
    });

    ws.on("close", () => {
      debug("Janus WebSocket client disconnected");
      if (keepaliveInterval) clearInterval(keepaliveInterval);
      if (janusWs && janusWs.readyState === WebSocket.OPEN) {
        const destroyMsg = {
          janus: "destroy",
          transaction: "txn_destroy_session",
          apisecret: config.JANUS_API_SECRET || undefined,
          session_id: sessionId,
        };
        janusWs.send(JSON.stringify(destroyMsg));
        debug(`Sent destroy message for session ${sessionId}`);
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
            console.debug("[JanusProxy] Upgraded connection on /janus");
            janusWss.emit("connection", ws, request);
          });
        }
      });
      debug("Janus WebSocket upgrade handling installed.");
    }
  },
};

function debug(msg) {
  console.debug("[JanusProxy]", msg);
}
