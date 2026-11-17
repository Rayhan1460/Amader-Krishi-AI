// Step 1: Diagnostic script for AgriSphere AI Registration & Network Error
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

const BACKEND_URL = 'http://127.0.0.1:8000';

function makeRequest(options, postData = null) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body,
          error: null,
        });
      });
    });

    req.on('error', (err) => {
      resolve({
        statusCode: null,
        headers: {},
        body: null,
        error: err.message,
        code: err.code,
      });
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runDiagnostics() {
  console.log('=== STEP 1 DIAGNOSTIC: TESTING ENDPOINTS BEFORE STARTING BACKEND ===');
  const beforeStart = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/health',
    method: 'GET',
  });
  console.log('Health check without backend:', beforeStart);

  console.log('\n=== SPAWNING BACKEND TO VERIFY STARTUP & ENDPOINTS ===');
  const backendDir = path.resolve(ROOT_DIR, 'backend');
  const pythonExe = path.resolve(backendDir, '.venv2', 'Scripts', 'python.exe');
  
  const backendProc = spawn(pythonExe, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendDir,
    env: {
      ...process.env,
      KERAS_HOME: path.resolve(backendDir, '.keras'),
    },
    stdio: 'pipe',
  });

  backendProc.stderr.on('data', (d) => {
    const str = d.toString();
    if (str.includes('ERROR') || str.includes('Exception')) {
      console.error('[Backend stderr]', str.trim());
    }
  });

  // Wait for server
  let online = false;
  for (let i = 0; i < 30; i++) {
    const res = await makeRequest({
      hostname: '127.0.0.1',
      port: 8000,
      path: '/health',
      method: 'GET',
    });
    if (res.statusCode === 200) {
      online = true;
      console.log('Backend is ONLINE on 127.0.0.1:8000!');
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!online) {
    console.error('Failed to start backend!');
    backendProc.kill();
    return;
  }

  // 1. GET /health
  console.log('\n--- 1. Testing GET /health ---');
  const healthRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/health',
    method: 'GET',
  });
  console.log('GET /health status:', healthRes.statusCode, 'body:', healthRes.body);

  // 2. GET /openapi.json
  console.log('\n--- 2. Testing GET /openapi.json ---');
  const openapiRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/openapi.json',
    method: 'GET',
  });
  console.log('GET /openapi.json status:', openapiRes.statusCode, 'length:', openapiRes.body?.length);

  // 3. CORS Preflight OPTIONS from http://localhost:5173
  console.log('\n--- 3a. Testing OPTIONS /auth/register from Origin http://localhost:5173 ---');
  const optionsResLocalhost = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/auth/register',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://localhost:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization',
    },
  });
  console.log('OPTIONS (localhost) status:', optionsResLocalhost.statusCode);
  console.log('OPTIONS (localhost) allow-origin:', optionsResLocalhost.headers['access-control-allow-origin']);
  console.log('OPTIONS (localhost) allow-methods:', optionsResLocalhost.headers['access-control-allow-methods']);
  console.log('OPTIONS (localhost) allow-headers:', optionsResLocalhost.headers['access-control-allow-headers']);
  console.log('OPTIONS (localhost) allow-credentials:', optionsResLocalhost.headers['access-control-allow-credentials']);

  // 3b. CORS Preflight OPTIONS from http://127.0.0.1:5173
  console.log('\n--- 3b. Testing OPTIONS /auth/register from Origin http://127.0.0.1:5173 ---');
  const optionsResIp = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/auth/register',
    method: 'OPTIONS',
    headers: {
      'Origin': 'http://127.0.0.1:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type,Authorization',
    },
  });
  console.log('OPTIONS (127.0.0.1) status:', optionsResIp.statusCode);
  console.log('OPTIONS (127.0.0.1) allow-origin:', optionsResIp.headers['access-control-allow-origin']);

  // 4. POST /auth/register with fresh test account
  const testUser = `diag_${Math.random().toString(36).substring(2, 8)}`;
  const testPass = 'DiagPass123!';
  const testEmail = `${testUser}@example.com`;
  console.log(`\n--- 4. Testing POST /auth/register (user: ${testUser}) ---`);
  const registerPayload = JSON.stringify({
    username: testUser,
    password: testPass,
    email: testEmail,
  });
  const regRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerPayload),
      'Origin': 'http://127.0.0.1:5173',
    },
  }, registerPayload);
  console.log('POST /auth/register status:', regRes.statusCode);
  const regData = JSON.parse(regRes.body || '{}');
  console.log('Token received:', regData.access_token ? '[PRESENT (token hidden)]' : '[MISSING]');

  // 5. POST /auth/login
  console.log(`\n--- 5. Testing POST /auth/login (user: ${testUser}) ---`);
  const loginPayload = JSON.stringify({
    username: testUser,
    password: testPass,
  });
  const loginRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginPayload),
      'Origin': 'http://127.0.0.1:5173',
    },
  }, loginPayload);
  console.log('POST /auth/login status:', loginRes.statusCode);
  const loginData = JSON.parse(loginRes.body || '{}');
  console.log('Login token received:', loginData.access_token ? '[PRESENT (token hidden)]' : '[MISSING]');

  // 6. GET /auth/me with Bearer token
  console.log('\n--- 6. Testing GET /auth/me with Bearer token ---');
  const meRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/auth/me',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${regData.access_token}`,
      'Origin': 'http://127.0.0.1:5173',
    },
  });
  console.log('GET /auth/me status:', meRes.statusCode, 'body:', meRes.body);

  // 7. Duplicate registration
  console.log('\n--- 7. Testing duplicate POST /auth/register ---');
  const dupRes = await makeRequest({
    hostname: '127.0.0.1',
    port: 8000,
    path: '/auth/register',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(registerPayload),
      'Origin': 'http://127.0.0.1:5173',
    },
  }, registerPayload);
  console.log('Duplicate register status:', dupRes.statusCode, 'body:', dupRes.body);

  backendProc.kill();
  console.log('\nDiagnostics completed and backend process stopped.');
}

runDiagnostics().catch(console.error);

