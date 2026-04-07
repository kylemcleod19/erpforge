/**
 * Structured JSON logger (pino).
 * Outputs JSON lines to stdout in all environments — Railway captures these
 * and ships them to log drains. Use `pino-pretty` locally if you want
 * formatted output: `npm run dev | npx pino-pretty`
 */
import pino from "pino";
import { config } from "./config";

export const logger = pino({ level: config.logLevel });

/**
 * Creates a child logger with a fixed component label.
 *   const log = childLogger("interview-service");
 *   log.info({ slug }, "session started");
 */
export function childLogger(component: string) {
  return logger.child({ component });
}
