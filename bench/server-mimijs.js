const { mimi } = require('../dist/index.js');
const app = mimi();

app.get('/', (req, res) => res.json({ hello: 'world' }));
app.get('/user/:id', (req, res) => res.json({ id: req.params.id }));

for (let i = 0; i < 50; i++) {
  app.get(`/r${i}`, (req, res) => res.json({ route: i }));
}

app.listen(3003);
module.exports = app;
