const bodyParser = require('body-parser');
const { json, urlencoded } = bodyParser;

// Create JSON and URL-encoded parsers
const jsonParser = json();
const urlencodedParser = urlencoded({ extended: false });

// Export the parsers
module.exports = {
  jsonParser,
  urlencodedParser,
};
