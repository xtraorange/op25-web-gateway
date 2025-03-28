// app.js
import JanusClient from "./janus.js";
import Op25Client from "./op25.js";

// Determine Janus WS URL from configuration or fallback.
const janusWsUrl =
  window.config && window.config.gateway_ws_janus_url
    ? window.config.gateway_ws_janus_url
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/janus`;

// Determine OP25 WS URL from configuration or fallback.
const op25WsUrl =
  window.config && window.config.gateway_ws_op25_url
    ? window.config.gateway_ws_op25_url
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/op25`;

// Instantiate Janus client.
window.janusClient = new JanusClient({
  wsUrl: janusWsUrl,
  audioElementId: "audioPlayer",
});
janusClient.initWebSocket(); // Connect on page load

// Instantiate OP25 client.
window.op25Client = new Op25Client({
  wsUrl: op25WsUrl,
});
op25Client.initWebSocket(); // Connect on page load

// Register a callback for OP25 messages.
op25Client.onMessage((msg) => {
  console.log("Received OP25 update:", msg);
  // Process OP25 updates, e.g., update UI.
});

// Expose functions to your HTML buttons.
// When the play button is clicked, Janus startStream is invoked.
window.startStream = function () {
  janusClient.startStream(1); // Start audio streaming with stream ID 1 when play is clicked.
};

window.sendCommand = function (command) {
  janusClient.sendCommand(command);
};
