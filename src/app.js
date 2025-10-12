/**
 * Express Application Setup
 * -------------------------
 * Handles:
 *  - Core Express app initialization
 *  - Global middleware registration
 *  - Security & CORS configuration
 *  - API route mounting
 *  - Centralized 404 & error handling
 */

const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');

const appConfig = require('./config/app.config');
const routes = require('./routes/index.routes');

const app = express();

/* ===========================
   GLOBAL MIDDLEWARES
   =========================== */

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parsing
app.use(cookieParser());

// Security headers (enabled in non-dev environments)
if (appConfig.NODE_ENV !== 'development') {
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    })
  );
}

// CORS (allow frontend to communicate with API)
app.use(
  cors({
    origin: appConfig.FRONTEND_URL,
    credentials: true,
  })
);

/* ===========================
   API ROUTES
   =========================== */
app.use('/api', routes);

/* ===========================
   404 HANDLER
   =========================== */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

/* ===========================
   GLOBAL ERROR HANDLER
   =========================== */
app.use((err, req, res, next) => {
  if (appConfig.NODE_ENV === 'development') console.error('Error:', err.stack || err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

module.exports = app;
