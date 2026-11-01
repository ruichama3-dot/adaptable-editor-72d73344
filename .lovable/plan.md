# Auditoria do backend RuJe IA (só leitura) e plano seguro para Pagar

Nada foi alterado. Evidências lidas no código deste projecto.

## 1. Backend activo
- Este projecto Lovable **não tem Lovable Cloud nem Supabase ligado** (estado do ambiente: `no_supabase`; os comandos de base de dados falharam em turnos anteriores).
- A app usa uma base de dados de **outro projecto Lovable Cloud**: o URL em `src/integrations/supabase/config.ts` é `c--fa123ac5-…-prod.lovable.cloud` (id fa123ac5), diferente deste projecto (64619a55). É um Lovable Cloud de origem (o projecto clonado), usado aqui como “externo”.
- `supabase/config.toml` tem `project_id = pzyyhmbswwfppfveltqm` — **não corresponde** ao URL acima. É resto do clone; não tem efeito em execução.

## 2. Configuração
- URL e chave publicável fixas em `config.ts` (públicas, seguras no navegador); variáveis `SUPABASE_URL`/`VITE_SUPABASE_*` podem substituí-las.
- Chave de serviço (`SUPABASE_SERVICE_ROLE_KEY`): exigida só por `client.server.ts`; não existe neste projecto.
- Pagar: `PAGAR_API_BASE_URL`, `PAGAR_API_KEY`, `PAGAR_SIGNING_SECRET`, `PAGAR_WEBHOOK_SECRET` previstas em `.env.example`; nenhuma integração activa.

## 3. Autenticação
- Navegador: `client.ts` cria o cliente com sessão persistente e renovação automática.
- Servidor: `src/lib/auth-guard.ts` (`requireAuth`) lê o token Bearer, deriva o URL do emissor (`iss`) do próprio token, valida com `auth.getUser` e, se falhar, `getClaims`. Corre com RLS como o utilizador.
- `src/start.ts`/`auth-attach.ts` anexam o token às chamadas do servidor.

## 4. Tabelas usadas no código
| Tabela | Usos | Colunas principais |
|---|---|---|
| payment_requests | 15 | id, user_id, plan, amount, method, phone, full_name, proof, status, created_at, updated_at |
| works | 13 | id, user_id, content, título/escola/curso…, is_public, download_count |
| profiles | 6 | id, email, nome… |
| subscriptions | 6 | id, user_id, plan, daily_limit, starts_at, expires_at |
| user_roles | 5 | id, user_id, role (enum app_role) |
| notifications / notification_reads | 3 / 2 | ver SQL de notificações |
| samples | 2 | amostras públicas |
- **Não existe tabela `exames`**: os exames são gerados por IA em tempo real (`exams.functions.ts`, `exam-*.functions.ts`) e não são guardados.
- Função `has_role(_user_id, _role)` usada em `access.ts` e nas políticas.

## 5. Migrations e RLS (5 ficheiros + `SQL-NOTIFICACOES.sql`)
- profiles: cada um gere o seu; admin lê todos.
- works: dono gere; anónimos lêem só `is_public = true`; admin lê todos.
- user_roles: lê o próprio; admin gere (mas só `SELECT` concedido a authenticated — falta `GRANT INSERT/UPDATE/DELETE`, por isso “Tornar admin” falha até ser executado).
- subscriptions: utilizador só lê; admin gere.
- payment_requests: utilizador lê e cria os seus; só admin altera (UPDATE concedido, mas RLS bloqueia não-admins — correcto).
- samples: leitura pública; admin gere.
- notifications: migration existe no projecto, mas **não há prova de que foi aplicada** na base real.
- Atenção: estas migrations **não são aplicadas automaticamente** à base real, porque este projecto não está ligado a ela.

## 6. Pode este projecto administrar a base real?
**Não.** Falta uma de duas opções:
- A) Abrir o projecto Lovable original (dono da base fa123ac5) e fazer lá as alterações/migrations; ou
- B) Neste projecto: Definições → Ligar Supabase/backend próprio (não é possível ligar uma Lovable Cloud de outro projecto por OAuth); ou adicionar `SUPABASE_SERVICE_ROLE_KEY` como segredo — dá acesso de servidor, mas não permite gerir migrations.
- Alternativa C) Activar Lovable Cloud aqui criaria uma **base nova e vazia** — os dados existentes não migrariam sozinhos. Não recomendado sem plano de migração.

## 7. Recomendação Pagar (sem afectar dados existentes)
Só acrescentar, nunca apagar ou renomear:
1. Nova tabela `payment_orders` (id, user_id, plan, amount esperado, provider_ref, status pending/paid/failed, created_at) e `payment_events` (event_id único, para idempotência).
2. Função de servidor autenticada “Pagar agora”: cria a ordem e chama a API Pagar com `PAGAR_API_KEY` (só no servidor), devolvendo o link/instruções.
3. Webhook em `src/routes/api/public/pagar/webhook.ts` (o actual `api.pagar.webhook.ts` está fora do prefixo público): verificar assinatura com Web Crypto (substituir `node:crypto`/`Buffer` para compatibilidade), rejeitar eventos repetidos, conferir montante e plano com a ordem.
4. Ao confirmar: inserir/prolongar `subscriptions` com o cliente de serviço e marcar a ordem paga — tudo numa função SQL `security definer` única para ser atómico.
5. Manter o fluxo actual com comprovativo e aprovação manual como alternativa; `resolveAccess` continua compatível.
6. Pré-requisitos: decidir A ou B acima; segredos `PAGAR_*` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente de produção; documentação da API Pagar para o formato exacto dos eventos.

## Próximo passo sugerido
Escolher onde a base será gerida (A ou B). Depois, implementar o ponto 7 por fases, testando primeiro com eventos de teste da Pagar.
