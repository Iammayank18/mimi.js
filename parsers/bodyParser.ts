import bodyParser from 'body-parser';
import { RequestHandler } from 'express';

// Create JSON and URL-encoded parsers
const jsonParser: RequestHandler = bodyParser.json();
const urlencodedParser: RequestHandler = bodyParser.urlencoded({ extended: false });

// Export the parsers
export {
  jsonParser,
  urlencodedParser,
};
