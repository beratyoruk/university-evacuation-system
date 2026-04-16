import rateLimit from "express-rate-limit";
import { RequestHandler } from "express";

/** Disable rate limiting in the test environment for deterministic suites. */
const isTest = process.env.NODE_ENV === "test";
const noop: RequestHandler = (_req, _res, next) => next();

/**
 * General API limiter — 100 requests per minute per IP.
 */
export const generalLimiter: RequestHandler = isTest
  ? noop
  : rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { success: false, error: "Too many requests, please try again later" },
    });

/**
 * Auth limiter — 5 requests per minute per IP.
 * Applied to login/register endpoints to prevent brute-force attacks.
 */
export const authLimiter: RequestHandler = isTest
  ? noop
  : rateLimit({
      windowMs: 60_000,
      limit: 5,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { success: false, error: "Too many authentication attempts, please try again in a minute" },
    });

/**
 * Location update limiter — 2 requests per second per IP.
 * Prevents flooding of real-time position updates.
 */
export const locationLimiter: RequestHandler = isTest
  ? noop
  : rateLimit({
      windowMs: 1_000,
      limit: 2,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { success: false, error: "Location updates are being throttled" },
    });
