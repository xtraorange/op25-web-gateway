// janus_audio_client.js
export default class JanusAudioClient {
  constructor({
    wsUrl, // now provided dynamically
    audioElementId = "audioPlayer",
  } = {}) {
    // Use the provided wsUrl, or fall back to the injected configuration.
    this.wsUrl =
      wsUrl ||
      (window.config && window.config.gateway_ws_url) ||
      `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${
        window.location.host
      }/ws`;
    this.audioElementId = audioElementId;
    this.ws = null;
    this.sessionId = null;
    this.handleId = null;
    this.peerConnection = null;
    this.isProcessingSDP = false;
    this.isWatching = false;
    this.iceCandidateQueue = [];
    this.audioElement = document.getElementById(audioElementId);
    if (!this.audioElement) {
      console.warn(`No <audio> element found with id="${audioElementId}"`);
    }
  }

  initWebSocket() {
    console.log("Creating WebSocket connection to:", this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);
    this.ws.onopen = () => {
      console.log("WebSocket connected");
      // Send initial message to indicate that this client wants to use the Janus service.
      this.ws.send(JSON.stringify({ service: "janus" }));
    };
    this.ws.onmessage = async (event) => {
      const message = JSON.parse(event.data);
      this.handleWSMessage(message);
    };
    this.ws.onclose = () => {
      console.warn("WebSocket connection closed");
      this.cleanupPeerConnection();
      setTimeout(() => this.initWebSocket(), 2000);
    };
    this.ws.onerror = (err) => console.error("WebSocket error:", err);
  }

  handleWSMessage(message) {
    console.log("Received:", message);
    if (message.event === "janus_session") {
      this.sessionId = message.sessionId;
      this.handleId = message.handleId;
      console.log(
        `Stored session: ${this.sessionId}, handle: ${this.handleId}`
      );
      return;
    }
    if (message.event === "streams") {
      console.log("Available Streams:", message.streams);
      return;
    }
    if (message.janus === "event" && message.jsep) {
      console.log("Received JSEP Offer from Janus:", message.jsep);
      this.handleRemoteSDP(message.jsep);
      return;
    }
    if (message.janus === "trickle") {
      console.log("Received ICE Candidate:", message.candidate);
      if (message.candidate && message.candidate.completed) {
        console.log("Received end-of-candidates from Janus, ignoring...");
        return;
      }
      this.addIceCandidate(message.candidate);
      return;
    }
    if (message.janus === "webrtcup") {
      console.log("Janus says WebRTC is fully up!");
      return;
    }
    if (message.janus === "keepalive") {
      console.log("Janus keepalive ping");
      return;
    }
    console.log("Unhandled message:", message);
  }

  async handleRemoteSDP(jsep) {
    if (this.isProcessingSDP) {
      console.warn("SDP already being processed, ignoring duplicate offer.");
      return;
    }
    this.isProcessingSDP = true;
    console.log("Handling SDP Offer...");
    setTimeout(() => {
      this.isProcessingSDP = false;
    }, 5000);
    this.cleanupPeerConnection();

    // Fetch TURN credentials from our backend
    let turnCredentials = {};
    try {
      const res = await fetch("/api/turn-credentials");
      turnCredentials = await res.json();
      console.log("Fetched TURN credentials:", turnCredentials);
    } catch (err) {
      console.error("Failed to fetch TURN credentials:", err);
    }

    // Get TURN server URL from the injected configuration (or use fallback)
    const turnServerUrl =
      window.config && window.config.turn_server_url
        ? window.config.turn_server_url
        : "turn:turn.example.com?transport=tcp";

    // Create RTCPeerConnection with TURN and STUN servers
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        {
          urls: turnServerUrl,
          username: turnCredentials.username || "defaultUsername",
          credential: turnCredentials.credential || "defaultCredential",
        },
        { urls: "stun:stun.l.google.com:19302" },
      ],
      // Uncomment the next line to force relay-only:
      // iceTransportPolicy: "relay"
    });

    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log("ICE Connection State:", state);
      if (state === "failed" || state === "disconnected") {
        console.warn(`ICE state is ${state}, attempting to reconnect...`);
        this.cleanupPeerConnection();
        this.isWatching = false;
        setTimeout(() => this.startStream(), 2000);
      }
    };

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("Sending ICE Candidate to Janus:", event.candidate);
        this.ws.send(
          JSON.stringify({
            janus: "trickle",
            session_id: this.sessionId,
            handle_id: this.handleId,
            candidate: event.candidate,
            transaction: `txn_${Date.now()}`,
          })
        );
      } else {
        console.log("ICE Candidate gathering complete.");
      }
    };

    this.peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      console.log("Remote audio stream received:", remoteStream);
      if (this.audioElement) {
        this.audioElement.srcObject = remoteStream;
        this.audioElement.muted = false;
        this.audioElement.volume = 1.0;
        this.audioElement
          .play()
          .then(() => console.log("Audio playback started."))
          .catch((err) => console.error("Audio play error:", err));
      }
    };

    try {
      await this.peerConnection.setRemoteDescription(jsep);
      console.log("Remote Description Set.");
      if (this.iceCandidateQueue.length > 0) {
        console.log("Processing queued ICE candidates.");
        for (const candidate of this.iceCandidateQueue) {
          await this.peerConnection.addIceCandidate(candidate);
          console.log("Queued ICE Candidate added");
        }
        this.iceCandidateQueue = [];
      }
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      console.log("Local Description Set, sending answer to Janus.");
      this.ws.send(
        JSON.stringify({
          janus: "message",
          session_id: this.sessionId,
          handle_id: this.handleId,
          body: { request: "start" },
          jsep: answer,
          transaction: `txn_${Date.now()}`,
        })
      );
    } catch (err) {
      console.error("Error handling SDP Offer:", err);
    } finally {
      this.isProcessingSDP = false;
    }
  }

  addIceCandidate(candidate) {
    if (this.peerConnection) {
      this.peerConnection
        .addIceCandidate(candidate)
        .then(() => console.log("ICE Candidate added"))
        .catch((err) => console.error("Error adding ICE Candidate:", err));
    } else {
      this.iceCandidateQueue.push(candidate);
    }
  }

  cleanupPeerConnection() {
    if (this.peerConnection) {
      console.log("Closing existing PeerConnection...");
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.isProcessingSDP = false;
  }

  startStream(streamId = 1) {
    if (!this.sessionId || !this.handleId) {
      console.warn("No session or handle ID. Cannot start stream.");
      return;
    }
    if (this.isWatching) {
      console.warn("Already watching, ignoring duplicate request.");
      return;
    }
    this.isWatching = true;
    console.log("Sending watch request to Janus");
    this.ws.send(
      JSON.stringify({
        janus: "message",
        session_id: this.sessionId,
        handle_id: this.handleId,
        body: { request: "watch", id: streamId, audio: true, video: false },
        transaction: `txn_${Date.now()}`,
      })
    );
  }

  // Example stub for sending additional commands if needed.
  sendCommand(command) {
    console.log("Sending command to Janus:", command);
    this.ws.send(
      JSON.stringify({
        janus: "message",
        session_id: this.sessionId,
        handle_id: this.handleId,
        body: { request: command },
        transaction: `txn_${Date.now()}`,
      })
    );
  }
}
