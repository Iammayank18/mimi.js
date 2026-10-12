# Agent Store example

A small store where every endpoint is an **action**. Each one is defined once and served as:

- a REST route (`GET /products`, `POST /orders`, …)
- an MCP tool at `/mcp` (Claude, ChatGPT, Cursor and other MCP clients can use it)
- an entry in `/.well-known/agent.json` and `/llms.txt`

Every write also gets dry-run plans, idempotency, approval gates, receipts with undo, per-agent budgets and an audit log, without extra code.

```bash
npm run build
node examples/agent-store/server.js        # terminal 1
node examples/agent-store/agent-demo.js    # terminal 2: a scripted "agent" over MCP
```

Try it by hand:

```bash
# Human call: plain JSON
curl localhost:3000/products?q=mug

# Agent call: envelope with receipt + next actions
curl -X POST localhost:3000/orders -H 'x-agent-id: me' -H 'content-type: application/json' \
  -d '{"productId":"p_tee","quantity":1,"email":"a@b.co"}'

# Preview without side effects
curl -X POST 'localhost:3000/orders?dryRun=true' -H 'content-type: application/json' \
  -d '{"productId":"p_hoodie","quantity":2,"email":"a@b.co"}'

# Find the right action from an intent
curl 'localhost:3000/_agent/find?q=give+the+customer+their+money+back'
```

Connect a real agent: add `http://localhost:3000/mcp` as a remote MCP server in your client.
