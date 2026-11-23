import type { NextFunction, Response } from 'express';
import type { CorrelatedRequest } from './correlation-id.js';

/** The part of a logger the access log needs. */
export interface AccessLogger {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Registers every HTTP access when it ends: method, path, status, duration and correlation id (SEC-WEB-06).
 * 401, 403, 429 and 4xx in general go out as warnings and 5xx as errors. It never writes the body, the headers
 * or the query string, so passwords and tokens cannot end up in the log.
 */
export function accessLogMiddleware(logger: AccessLogger) {
  return (req: CorrelatedRequest, res: Response, next: NextFunction): void => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const milliseconds = Number(process.hrtime.bigint() - started) / 1_000_000;
      const line =
        `${req.method} ${req.path} ${res.statusCode} ${milliseconds.toFixed(0)}ms ` +
        `instance=${req.correlationId ?? '-'}`;
      if (res.statusCode >= 500) logger.error(line);
      else if (res.statusCode >= 400) logger.warn(line);
      else logger.log(line);
    });
    next();
  };
}
