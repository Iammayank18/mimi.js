// parsers/customParser.js
module.exports = (req, res, next) => {
  if (req.headers["content-type"] === "application/custom") {
    // Custom parsing logic
    req.body = {}; // Parsed custom data
  }
  next();
};
