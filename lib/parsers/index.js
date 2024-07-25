const { jsonParser, urlencodedParser } = require('./bodyParser');
const customParser = require('./customParser');

module.exports = { jsonParser, urlencodedParser, customParser };
