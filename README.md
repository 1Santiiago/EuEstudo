# Meu Estudo

Aplicação PWA de planejamento pessoal de estudos, construída com Next.js, React e Tailwind CSS.

## Rodar localmente

- Requer Node.js 20.9 ou superior.
- `npm install`
- `npm run dev` inicia o servidor de desenvolvimento em `http://localhost:3000`.
- `npm run build` gera a versão de produção.
- `npm start` inicia localmente a versão já compilada.

## Configurar o Supabase

1. No painel do projeto, abra **SQL Editor**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e execute. Isso cria a tabela de estado e políticas RLS para cada conta acessar somente os próprios dados.
2. As variáveis locais já ficam em `.env.local` (arquivo ignorado pelo Git). Para outra máquina, copie `.env.example` para `.env.local` e preencha a URL e a publishable key.
3. Em **Authentication → URL Configuration**, defina a URL local e, depois da publicação, a URL de produção como Site URL/Redirect URL. Se a confirmação de e-mail estiver ativada, os usuários precisam confirmar o endereço antes do primeiro login.

O primeiro cadastro com dados locais importa esse plano para a conta Supabase. Depois disso, cada conta mantém seus dados separados na nuvem; o navegador conserva também um cache local por usuário.

## Publicar na Vercel

Importe o repositório no painel da Vercel, configure `meu-estudo-codigo-fonte-pwa` como **Root Directory** se o repositório contiver outros projetos, mantenha o framework **Next.js** e deixe os comandos detectados automaticamente. Em **Settings → Environment Variables**, cadastre:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Use os mesmos valores do `.env.local` e habilite as variáveis para Production, Preview e Development conforme necessário. A publishable key pode ser usada no cliente porque o banco aplica RLS. Nunca adicione uma secret/service_role key ao app ou a variáveis `NEXT_PUBLIC_*`.

O build é `npm run build`. A compilação foi validada localmente. O código legado de Cloudflare/Vinext e D1 não participa do deploy atual.
