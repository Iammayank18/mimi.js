'use strict';

const { verifyToken } = require('./authHelper');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization.split(' ')[1];
  if (!token) {
    res.status(401).json({ message: 'No token provided' });
    return; // Ensure that the function returns after sending a response
  }

  const decoded = verifyToken(token);

  if (decoded === null) {
    res.status(401).json({ message: 'Invalid token' });
    return; // Ensure that the function returns after sending a response
  }

  // Attach the decoded token to the request object
  req.user = decoded;
  next(); // Call next() to pass control to the next middleware
};

module.exports = authMiddleware;
