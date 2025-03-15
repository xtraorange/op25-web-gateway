import JanusAudioClient from "./janus_audio_client.js";

// Determine the WebSocket URL dynamically using the injected configuration.
const wsUrl =
  window.config && window.config.WS_URL
    ? window.config.WS_URL
    : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
        window.location.host
      }`;

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
