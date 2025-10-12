/**
 * Main Server Entry Point (with Mongoose)
 *
 * Responsibilities:
 *  - Initialize the HTTP server
 *  - Connect to MongoDB (via Mongoose)
 *  - Attach socket.io (or custom socket handling)
 *  - Start listening on configured port
 */

const http = require("http");
const app = require("./src/app");
const { connectDB } = require("./src/config/db.config");
const config = require("./src/config/app.config");
const { setupSocket } = require("./src/config/socket.config");

// Create an HTTP server using the Express app
const server = http.createServer(app);

// Attach WebSockets to the HTTP server
setupSocket(server);

/**
 * Start server only after DB connection is successful
 */
connectDB()
  .then(() => {
    server.listen(config.PORT, () => {
      console.log(`[SERVER] Running at ${config.BASE_URL}`);
    });
  })
  .catch((err) => {
    console.error("[MONGO] Connection failed:", err.message || err);
    process.exit(1);
  });
