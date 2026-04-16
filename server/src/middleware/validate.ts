import { Request, Response, NextFunction } from "express";
import { ZodError, ZodSchema } from "zod";

type Source = "body" | "query" | "params";

/**
 * Request validation middleware — validates a given request property
 * against a zod schema and replaces the property with parsed data.
 * On failure, responds with 400 and a flattened list of error messages.
 */
export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      (req as Request & Record<Source, unknown>)[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: err.errors.map((e) => ({
            path: e.path.join("."),
            message: e.message,
          })),
        });
        return;
      }
      next(err);
    }
  };
}
