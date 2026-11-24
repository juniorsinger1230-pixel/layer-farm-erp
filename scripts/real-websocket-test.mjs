import assert from 'node:assert/strict';
import pg from 'pg';
import WebSocket from 'ws';
import { AuthService } from '../dist/packages/security/src/auth.js';
import { PostgresAuthStore } from '../dist/packages/security/src/postgres-store.js';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const auth = new AuthService(new PostgresAuthStore(pool), { issuer: 'layer-farm-erp', audience: 'layer-farm-web', signingKey: process.env.JWT_SIGNING_KEY });
const company = await pool.query("SELECT id FROM app.company WHERE company_code='THL'");
try {
  await auth.register('real.websocket', 'Synthetic-Test-Passw0rd!2026', { employeeId: 9010, employeeNo: 'REAL-WS', companyCode: 'THL', companyId: Number(company.rows[0].id), mfaEnrolled: false, roles: [{ role: 'sales_manager' }] });
} catch (error) {
  if (error?.code !== 'VALIDATION_ERROR') throw error;
}
const login = await fetch('http://127.0.0.1:3210/api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ account: 'real.websocket', password: 'Synthetic-Test-Passw0rd!2026', companyCode: 'THL' }) });
assert.equal(login.status, 200);
const token = (await login.json()).data.accessToken;
const openSocket = (suffix = '') => new Promise((resolve, reject) => {
  const socket = new WebSocket(`ws://127.0.0.1:3210/api/v1/events/ws?token=${encodeURIComponent(token)}${suffix}`);
  const messages = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  socket.once('open', () => resolve({ socket, messages }));
  socket.once('error', reject);
});
const waitFor = async (check) => {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) { const value = check(); if (value) return value; await new Promise((resolve) => setTimeout(resolve, 50)); }
  throw new Error('WebSocket condition timeout');
};
try {
  const first = await openSocket();
  await waitFor(() => first.messages.some((message) => message.type === 'ready'));
  first.socket.send(JSON.stringify({ type: 'ping' }));
  await waitFor(() => first.messages.some((message) => message.type === 'pong'));
  first.socket.send(JSON.stringify({ type: 'replay', afterSequence: 0 }));
  const initial = await waitFor(() => first.messages.find((message) => message.type === 'event'));
  const lastSequence = initial.sequence;
  first.socket.close();
  await new Promise((resolve) => first.socket.once('close', resolve));
  const second = await openSocket();
  await waitFor(() => second.messages.some((message) => message.type === 'ready'));
  second.socket.send(JSON.stringify({ type: 'replay', afterSequence: lastSequence }));
  const replayed = await waitFor(() => second.messages.find((message) => message.type === 'event'));
  assert.ok(replayed.sequence > lastSequence);
  second.socket.close();
  console.log(JSON.stringify({ result: 'passed', test: 'REAL-WS-001', pingPong: true, firstSequence: lastSequence, replayedSequence: replayed.sequence, ordered: true }));
} finally {
  await pool.end();
}
