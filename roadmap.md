# Roadmap — RuJe IA

## Concluído
- [x] Vercel: configuração pública incluída no projecto; aviso de SUPABASE_URL removido
- [x] GitHub: ficheiros `.env` privados ignorados e `.env.example` seguro incluído
- [x] Autenticação resiliente (auth-guard.ts, auth-attach.ts) — validar em produção
- [x] Geração de trabalhos com Gemini (models: gemini-3.6-flash primeiro)
- [x] Administrador com acesso ilimitado (access.ts: has_role + fallback user_roles)
- [x] Pagamento aprovado → acesso ao plano comprado (validade desde a aprovação)
- [x] Botão instalar PWA no painel; logo actualizada; PWA persistente
- [x] Quiz pós-registo → planos; overlay "A gerar o seu trabalho…"

## Em curso
- [x] Substituir a amostra visível pelo PDF enviado, acessível também na criação de trabalhos
- [x] Explicitar no registo o mínimo de 6 caracteres sem exigir números nem símbolos
- [x] Acionar o pedido de instalação pelo botão sempre que o navegador o permitir
- [x] Adaptar navegação, formulários, pagamentos, painel, editor e administração para telemóvel sem perder a experiência no computador
- [x] Descarregar trabalho acima das páginas em PDF ou Word, em telemóvel e computador
- [x] Melhorar a organização das páginas e a formatação dos trabalhos gerados
- [ ] Esconder selo "Edit with Lovable" (CSS adicionado a styles.css — definição oficial exige plano Pro)
- [ ] Typecheck e verificação final dos fluxos de acesso

## Bloqueado / depende do utilizador
- [ ] Vercel: adicionar apenas GEMINI_API_KEY em Settings → Environment Variables; redeploy
- [ ] Selo da Lovable via definição oficial — exige plano Pro (workaround CSS aplicado)
