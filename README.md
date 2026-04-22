# Home Fest | Sistema Financeiro + Documentos Supabase

## O que esta versão entrega
- módulo **Documentos**
- drag and drop premium
- upload múltiplo
- armazenamento em **Supabase Storage**
- metadados em **Supabase PostgreSQL**
- vínculo opcional com eventos
- estados separados:
  - extraído
  - sugerido
  - confirmado

## 1) Preparar o banco no Supabase
Abra o SQL Editor e rode o arquivo:

`supabase/etapa04_documentos_supabase.sql`

Esse SQL:
- cria a tabela `documentos`
- prepara bucket `documentos-homefest`
- cria policies básicas
- completa campos mínimos em `eventos`

## 2) Rodar local
Abra `src/env.js` e preencha:

```js
export const env = {
  supabaseUrl: 'https://SEU-PROJETO.supabase.co',
  supabaseAnonKey: 'SUA_CHAVE_PUBLICA_ANON',
  storageBucket: 'documentos-homefest'
};
```

Depois:

```bash
npm run dev
```

Abra:
`http://localhost:5173`

## 3) Build para Cloudflare Pages
No terminal:

```bash
npm run build
```

O build gera a pasta `dist`.

## 4) Variáveis para produção
No Cloudflare Pages, cadastrar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_STORAGE_BUCKET=documentos-homefest`

## 5) Regras importantes
- documento **não lança financeiro sozinho**
- confirmação humana continua obrigatória
- bucket está público nesta fase para simplificar preview e teste
- quando o módulo de usuários/auth entrar, a policy deve ser endurecida

## 6) Primeiro commit
```bash
git init
git branch -M main
git add .
git commit -m "feat: documentos com supabase storage"
git remote add origin https://github.com/rafael12eja-dotcom/homefest-financeiro.git
git push -u origin main
```


## Etapa 1 — Bloco 3

Este pacote já inclui o frontend operacional de inconsistências, com filtros, detalhe e ações de status.
Se a tabela `public.inconsistencias` ainda não tiver as colunas `observacao`, `responsavel` e `resolvida_em`, o frontend continua funcionando com fallback de atualização apenas do `status`.


## Evolução atual do módulo de inconsistências
- histórico operacional por inconsistência
- comentários operacionais
- justificativa obrigatória ao ignorar
- alertas clicáveis no dashboard
- fallback seguro quando tabelas auxiliares ainda não existirem

## SQL opcional desta etapa
Rode também:
- `supabase/etapa01d_inconsistencias_historico_comentarios.sql`

Esse arquivo cria ou reforça colunas auxiliares na tabela `inconsistencias` e garante as tabelas:
- `inconsistencias_historico`
- `inconsistencias_comentarios`


## Observação importante sobre o Supabase
No SQL Editor, cole o conteúdo do arquivo `.sql`. Não execute o caminho do arquivo como se fosse um comando SQL.


## Login multiusuário

Antes de usar o login, rode no Supabase o arquivo `supabase/etapa00_login_multiplos_usuarios.sql`.

Usuário inicial:
- e-mail: `admin@homefest.local`
- senha: `HomeFest2026!`
