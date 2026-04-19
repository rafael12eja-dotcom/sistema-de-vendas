const fs = require('fs');
const path = require('path');

const source = __dirname;
const target = path.join(__dirname, 'dist');

function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir, {recursive:true}); }
function copyDir(src, dest){
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, {withFileTypes:true})) {
    if (['dist', '.git', 'node_modules'].includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(srcPath, destPath);
    else fs.copyFileSync(srcPath, destPath);
  }
}

function writeEnvFile(destRoot){
  const envContent = `export const env = {
  supabaseUrl: ${JSON.stringify(process.env.VITE_SUPABASE_URL || '')},
  supabaseAnonKey: ${JSON.stringify(process.env.VITE_SUPABASE_ANON_KEY || '')},
  storageBucket: ${JSON.stringify(process.env.VITE_SUPABASE_STORAGE_BUCKET || 'documentos-homefest')}
};
`;
  const envPath = path.join(destRoot, 'src', 'env.js');
  ensureDir(path.dirname(envPath));
  fs.writeFileSync(envPath, envContent, 'utf-8');
}

if (fs.existsSync(target)) fs.rmSync(target, {recursive:true, force:true});
copyDir(source, target);
writeEnvFile(target);
console.log('Build concluído em ./dist');
