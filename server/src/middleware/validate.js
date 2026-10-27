/**
 * Declarative Zod validation middleware for Express routes.
 * Validates request body, query params, or route parameters, returning standardized 400 Bad Request envelopes.
 */

export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = (result.error.issues || []).map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        message: details[0]?.message || 'Invalid request payload',
        details
      });
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const details = (result.error.issues || []).map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        message: details[0]?.message || 'Invalid query parameters',
        details
      });
    }
    req.query = result.data;
    next();
  };
}

export function validateParams(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      const details = (result.error.issues || []).map(err => ({
        field: err.path.join('.'),
        message: err.message
      }));
      return res.status(400).json({
        error: 'Validation failed',
        message: details[0]?.message || 'Invalid route parameters',
        details
      });
    }
    req.params = result.data;
    next();
  };
}
