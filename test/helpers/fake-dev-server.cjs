// Minimal stand-in for a dev server: serves 200 on any path, port from argv.
const http = require('node:http');
const port = Number(process.argv[2] || 5999);
http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<html><body>ok</body></html>'); }).listen(port, '127.0.0.1');
