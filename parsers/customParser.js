
module.exports = (req, res, next) => {
  if (req.headers["content-type"] === "application/custom") {

    req.body = {}; // Parsed custom data
  }
  next();
};
