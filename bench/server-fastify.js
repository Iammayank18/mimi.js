const Fastify = require('fastify');
const app = Fastify();

app.get('/', async () => ({ hello: 'world' }));
app.get('/user/:id', async (req) => ({ id: req.params.id }));

for (let i = 0; i < 50; i++) {
  app.get(`/r${i}`, async () => ({ route: i }));
}

app.listen({ port: 3002 }).then(() => {});
module.exports = app;
