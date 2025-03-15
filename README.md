# OP25 Web Gateway

**OP25 Web Gateway** is a Node.js proxy server that provides a web interface for controlling and monitoring digital radio systems. It acts as a gateway for both Janus signaling (audio proxy) and OP25 API/WebSocket functionality. Its modular design conditionally activates features based on your environment settings, ensuring that only the desired proxy components are enabled.

## Features

- **Static File Serving & Frontend Config:**\
  Serves static files from the `public/` folder and exposes a `/config.js` endpoint for client-side configuration.

- **TURN Credentials Endpoint:**\
  Generates TURN credentials via Cloudflare (if required Cloudflare TURN settings are provided).

- **Janus Proxy (Audio):**\
  Proxies WebSocket connections to your Janus server for audio streaming. Activated only if `JANUS_WS_URL` is set.

- **OP25 HTTP API Proxy:**\
  Forwards HTTP API requests (e.g., update, hold, skip, whitelist/blacklist, talkgroup management, status, logs) to your external OP25 server. Activated only if `OP25_API_SERVER_URL` is set.

- **OP25 WebSocket Proxy:**\
  Proxies WebSocket connections to your OP25 server's WS endpoint for real‑time status updates. Activated only if `OP25_API_WS_URL` is set.

- **Conditional Activation & Verbose Debug Logging:**\
  Each feature is enabled only when its corresponding environment variable is provided. Detailed debug logs trace configuration and proxy activity.

## Requirements

- [Node.js](https://nodejs.org/) (v14 or later recommended)
- npm (Node Package Manager)

## Installation

1.  **Clone the Repository:**

        ```bash
        git clone https://github.com/yourusername/op25-web-gateway.git
        ```

    cd op25-web-gateway`

2.  **Install Dependencies:**

    ```bash
    npm install
    ```

## Configuration

This project uses a `.env` file for all configuration. Copy the provided `.env.example` to `.env` and modify the values to suit your environment.

### .env.example

```dotenv
# General Server Configuration

# The port on which your proxy webserver will run.

PORT=3000

# -------------------------------------------------------------------

# Janus Proxy Configuration

# Set the Janus WebSocket URL to enable the Janus (audio) proxy functionality.

# If JANUS_WS_URL is empty or not set, the Janus proxy will be disabled.

# Example: JANUS_WS_URL=ws://your-janus-server:8188/janus

JANUS_WS_URL=

# Optional: Provide the Janus API secret if required by your Janus server.

# If left blank, the server will not insert a secret into Janus requests.

JANUS_API_SECRET=

# -------------------------------------------------------------------

# TURN / Cloudflare Configuration (Used by Janus proxy)

# This enables Cloudflare as your TURN server for the Janus proxy.

# If the TURN key ID and API token are not provided, the TURN proxy will be disabled.

# Cloudflare TURN Key ID: provided by Cloudflare.

CLOUDFLARE_TURN_KEY_ID=your_turn_key_id_here

# Cloudflare TURN API Token: used to generate TURN credentials.

CLOUDFLARE_TURN_API_TOKEN=your_cloudflare_api_token_here

# Optional: Time-To-Live (in seconds) for generated TURN credentials. (Default: 86400 - 24 hours)

CLOUDFLARE_TURN_CREDENTIAL_TTL=86400

# Optional: Custom identifier for TURN credentials. (Default: op25_web_gateway)

CLOUDFLARE_TURN_CUSTOM_IDENTIFIER=op25_web_gateway

# -------------------------------------------------------------------

# OP25 Proxy Configuration

# Set the URL of your OP25 server's HTTP API.

# If OP25_API_SERVER_URL is empty or not set, the OP25 HTTP API proxy will be disabled.

OP25_API_SERVER_URL=http://your-op25-server

# Set the URL of your OP25 server's WebSocket endpoint.

# If OP25_API_WS_URL is empty or not set, the OP25 WebSocket proxy will be disabled.

OP25_API_WS_URL=ws://your-op25-server/ws

# Optional: Set a shared secret token for OP25 API requests.

# If left blank, the server will omit the token from proxy requests.

OP25_API_SECRET_TOKEN=

# -------------------------------------------------------------------

# Websocket Configuration

# Set the URL of your public websocket endpoint for this server.

# If left blank, this will be constructed from the server's public URL.

WS_URL=
```

#### Explanation

- **PORT:**\
  The TCP port your server listens on.

- **Janus Proxy Settings:**

  - `JANUS_WS_URL` activates the Janus proxy.
  - `JANUS_API_SECRET` is optional; if left blank, no secret is added.

- **TURN/Cloudflare Settings:**\
  These values enable the TURN credentials endpoint using Cloudflare's TURN service. Both `CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` must be set for the endpoint to be active.

- **OP25 Proxy Settings:**

  - `OP25_API_SERVER_URL` activates the HTTP API proxy for OP25.
  - `OP25_API_WS_URL` activates the WebSocket proxy for OP25.
  - `OP25_API_SECRET_TOKEN` is an optional token for authenticating proxy requests.

- **WS_URL:**\
  The public WebSocket URL for client-side configuration. If left blank, your client can derive it from the server URL.

## Running the Server

Start the server using:

```bash
npm start
```

The server will listen on the port defined in your `.env` file. Detailed debug messages will be output to the console, indicating which features are enabled and how requests are being processed.

## WebSocket Upgrade Handling

- **Janus Proxy:**\
  WebSocket upgrade requests with paths starting with `/janus` are handled by the Janus proxy (if enabled).

- **OP25 WebSocket Proxy:**\
  Upgrade requests with paths starting with `/op25ws` are handled by the OP25 WebSocket proxy (if enabled).

## API Endpoints

- **TURN Credentials:**\
  `GET /api/turn-credentials` -- Generates and returns TURN credentials using Cloudflare (if configured).

- **OP25 HTTP API Proxy:**\
  All endpoints under `/api/op25/` (e.g., `/api/op25/update`, `/api/op25/hold`, `/api/op25/whitelist`, etc.) are forwarded to your external OP25 server, if `OP25_API_SERVER_URL` is set.

- **Frontend Configuration:**\
  `GET /config.js` -- Returns a JavaScript snippet with configuration for your frontend clients.

## Debugging

The server outputs detailed debug logs (using `console.debug` and `console.error`) that show:

- Loaded environment configuration.
- Which proxy features (Janus, OP25 HTTP, OP25 WS) are enabled or disabled.
- Details of WebSocket connections, proxied API requests, and TURN credential generation.

Use these logs to troubleshoot and verify that your environment variables are correctly set.

## License

This project is licensed under the MIT License.
