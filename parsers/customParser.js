// Define the custom parser middleware
const customParser = (req, res, next) => {
  if (req.headers['content-type'] === 'application/custom') {
    req.body = {}; // Parsed custom data
  }
  next();
};

// Export the middleware
module.exports = customParser;
