// Async handler to wrap async route handlers
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Global error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Prisma errors
  if (err.code === 'P2002') {
    const field = err.meta?.target?.[0];
    const messages = {
      username: 'Username is already taken',
      email: 'An account with this email already exists',
    };
    return res.status(409).json({
      error: messages[field] || 'A record with this value already exists',
      field,
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Record not found' });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  // Default error — never leak internal messages to clients in production
  const isProd = process.env.NODE_ENV === 'production';
  res.status(err.status || 500).json({
    error: isProd && (!err.status || err.status >= 500)
      ? 'An internal server error occurred'
      : (err.message || 'Internal server error'),
  });
};

module.exports = {
  asyncHandler,
  errorHandler,
};
