// Plays the part of an AI agent talking to the store over MCP — no LLM needed.
// Start the server first:  node examples/agent-store/server.js
// Then:                    node examples/agent-store/agent-demo.js
const BASE = process.env.BASE ?? 'http://localhost:3000';
let id = 0;

async function mcp(method, params) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'mcp-method': method, 'x-agent-id': 'demo-agent', 'x-agent-name': 'Demo Agent' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++id, method, params }),
  });
  return (await res.json()).result;
}
const call = async (name, args) => (await mcp('tools/call', { name, arguments: args })).structuredContent;
const step = (t, v) => console.log(`\n▶ ${t}\n${JSON.stringify(v, null, 2)}`);

(async () => {
  const init = await mcp('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'demo', version: '1' } });
  step('Server instructions the model receives', init.instructions);

  const { tools } = await mcp('tools/list');
  step('Tools (with safety hints)', tools.map((t) => ({ name: t.name, ...t.annotations })));

  step('Agent sends a wrong type — gets a fix, not just a 422', await call('placeOrder', { productId: 'p_mug', quantity: '2' }));

  step('Agent previews the order first (dry run — nothing charged)', await call('placeOrder', { productId: 'p_tee', quantity: 3, email: 'sam@example.com', _dryRun: true }));

  const key = 'order-sam-tee-1';
  const order = await call('placeOrder', { productId: 'p_tee', quantity: 3, email: 'sam@example.com', _idempotencyKey: key });
  step('Agent places the order (gets receipt + next steps)', order);

  step('Network blip → agent retries with same key → no double charge', await call('placeOrder', { productId: 'p_tee', quantity: 3, email: 'sam@example.com', _idempotencyKey: key }));

  const big = await call('refundOrder', { orderId: order.data.orderId, amount: 60, reason: 'customer changed mind' });
  step('Big refund → parked for a human, with the exact plan', big);

  step('Agent tells the user and checks back later', await call('check_approval', { approvalId: big.approval.id }));

  step('Agent made a mistake → undo via receipt', await call('undo_action', { receiptId: order.receipt.id }));

  step('Agent tries a human-only action', await call('deleteCustomerData', { email: 'sam@example.com' }));

  console.log(`\nNow open ${BASE}/_agent/insights and ${BASE}/_agent/activity to see what the agent did.`);
})();
