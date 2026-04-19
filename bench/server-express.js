const express = require('express');
const app = express();

// Scenario 1: simple JSON
app.get('/', (req, res) => res.json({ hello: 'world' }));

// Scenario 2: route with params
app.get('/user/:id', (req, res) => res.json({ id: req.params.id }));

// Scenario 3: 50-route app (hit /r25)
for (let i = 0; i < 50; i++) {
  app.get(`/r${i}`, (req, res) => res.json({ route: i }));
}

const server = app.listen(3001, () => {});
module.exports = server;
