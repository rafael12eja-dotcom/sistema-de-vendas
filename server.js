const http = require('http');
const fs = require('fs');
const path = require('path');

const port = process.env.PORT || 5173;
const root = __dirname;
const mime = {
  '.html':'text/html; charset=utf-8',
  '.js':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.pdf':'application/pdf',
  '.txt':'text/plain; charset=utf-8'
};

function ensureLocalEnvFile() {
  const envPath = path.join(root, 'src', 'env.js');
  if (fs.existsSync(envPath)) return;
  const content = `export const env = {
  supabaseUrl: ${JSON.stringify(process.env.VITE_SUPABASE_URL || '')},
  supabaseAnonKey: ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || '')},
  storageBucket: ${JSON.stringify(process.env.VITE_SUPABASE_STORAGE_BUCKET || 'documentos-homefest')}
};
`;
  fs.writeFileSync(envPath, content, 'utf-8');
}

ensureLocalEnvFile();

http.createServer((req, res) => {
  const cleanPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const urlPath = cleanPath === '/' ? '/index.html' : cleanPath;
  const filePath = path.join(root, urlPath);
  if (!filePath.startsWith(root)) {
    res.writeHead(403, {'Content-Type':'text/plain; charset=utf-8'});
    res.end('Acesso negado');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8'});
      res.end('Arquivo não encontrado');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {'Content-Type': mime[ext] || 'application/octet-stream'});
    res.end(data);
  });
}).listen(port, () => {
  console.log(`Home Fest rodando em http://localhost:${port}`);
});
