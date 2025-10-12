/**
 * Chyloo Configuration
 * --------------------------
 * Centralized config values loaded from environment variables.
 */

require('dotenv').config({ quiet: true });

const APP_NAME = process.env.APP_NAME || 'Chyloo';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

module.exports = {
  // App Info
  APP_NAME,
  PORT: process.env.PORT || 3000,
  BASE_URL: process.env.BASE_URL || 'http://192.168.100.4:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://192.168.100.4:5173',
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DB_NAME: process.env.DB_NAME || 'chyloo',
  MONGODB_URI: process.env.MONGODB_URI,

  // Security
  SALT_ROUNDS: parseInt(process.env.SALT_ROUNDS, 10) || 12,
  MAX_AGE: parseInt(process.env.MAX_AGE, 10) || THIRTY_DAYS,

  // Email (optional, useful for forgot password / verification)
  EMAIL_SERVICE: process.env.EMAIL_SERVICE || 'gmail',
  EMAIL_USERNAME: process.env.EMAIL_USERNAME,
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD,
  EMAIL_FROM: `${APP_NAME} <${process.env.EMAIL_USERNAME}>`,
};
