import { randomUUID } from 'node:crypto';
import { type ArgumentsHost, Catch, type ExceptionFilter, Logger } from '@nestjs/common';
import type { Response } from 'express';
import type { CorrelatedRequest } from './correlation-id.js';
import { mapException } from './exception-mapper.js';
import { buildProblem } from './problem-details.js';

/**
 * The single exit of every error (D-39, D-51, SEC-API-08, SEC-WEB-07): whatever is thrown, the client gets
 * Problem Details (`application/problem+json`) with its `code`, and never a stack or a message of a library.
 * It catches everything, also what the framework itself throws (malformed JSON, body too large, unknown route),
 * and it fails closed: anything unknown is a 500 `internal-error`.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly problemBaseUri: string) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<CorrelatedRequest>();
    const response = http.getResponse<Response>();

    const correlationId = request.correlationId ?? randomUUID();
    const mapped = mapException(exception);
    const problem = buildProblem(this.problemBaseUri, mapped.code, correlationId, mapped.errors);

    // The details of an unexpected error stay on the server, under the same id the client received.
    if (mapped.unexpected !== undefined) {
      const stack = mapped.unexpected instanceof Error ? mapped.unexpected.stack : undefined;
      this.logger.error(`Unexpected error instance=${correlationId}`, stack);
    }

    for (const [name, value] of Object.entries(mapped.headers)) response.setHeader(name, value);
    response.status(problem.status).type('application/problem+json').send(JSON.stringify(problem));
  }
}
