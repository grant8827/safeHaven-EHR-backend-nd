/**
 * Rate limiting middleware for sensitive endpoints.
 * Uses express-rate-limit with an in-memory store (sufficient for single-instance Railway deployments).
 * If a Redis store is needed for multi-instance scaling, swap in rate-limit-redis.
 */
const rateLimit = require('express-rate-limit');

/**
 * Strict limiter for authentication endpoints (login, password reset).
 * 10 attempts per 15 minutes per IP; returns JSON on limit hit.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,   // Return rate limit info in RateLimit-* headers
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
  skipSuccessfulRequests: false,
});

/**
 * General API limiter — applied globally to prevent scraping / brute-force.
 * 300 requests per 15 minutes per IP.
 */
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

module.exports = { authLimiter, generalLimiter };
