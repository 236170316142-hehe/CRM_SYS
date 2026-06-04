const http = require('http');
const body = JSON.stringify({ email: 'admin@crm.com', password: 'admin123' });
const req = http.request({ hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => { console.log('Login Response:', res.statusCode, d); });
});
req.write(body);
req.end();
