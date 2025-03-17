// app.js
import JanusAudioClient from "./janus_audio_client.js";

// Determine the WebSocket URL dynamically using the injected configuration.
// If window.config.gateway_ws_url is set, use that; otherwise, fall back to a constructed URL.
const wsUrl =
  window.config && window.config.gateway_ws_url
    ? window.config.gateway_ws_url
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
        window.location.host
      }/ws`;

window.janusClient = new JanusAudioClient({
  wsUrl,
  audioElementId: "audioPlayer",
});

// Initialize the WebSocket connection when the page loads.
window.onload = () => {
  janusClient.initWebSocket();
};

// Expose functions to the HTML buttons.
window.startStream = function () {
  janusClient.startStream(1); // Example: using stream ID 1
};

window.sendCommand = function (command) {
  janusClient.sendCommand(command);
};
