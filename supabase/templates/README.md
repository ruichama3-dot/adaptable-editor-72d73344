# E-mails de autenticação — RuJe IA

Os modelos HTML desta pasta foram preparados para a autenticação hospedada na Supabase. Incluem confirmação, recuperação de palavra-passe, magic link, alteração de e-mail, convite e reautenticação.

## Aplicar no projecto Supabase de produção

Project ref: `vlckoouduqhgmizkfwao`

1. Abra [Authentication → Email Templates](https://supabase.com/dashboard/project/vlckoouduqhgmizkfwao/auth/templates).
2. Em **Confirm signup**, cole o ficheiro `confirmation.html` actualizado e guarde. A aplicação espera um OTP numérico de 6 dígitos.
3. Para cada fluxo, copie o conteúdo do ficheiro correspondente desta pasta para o campo **Message** e defina o assunto:
   - `confirmation.html` — `Confirme o seu e-mail | RuJe IA`
   - `recovery.html` — `Recuperar palavra-passe | RuJe IA`
   - `magic_link.html` — `Aceder à RuJe IA`
   - `email_change.html` — `Confirme a alteração do e-mail | RuJe IA`
   - `invite.html` — `Convite para a RuJe IA`
   - `reauthentication.html` — `Confirme a sua identidade | RuJe IA`
4. Guarde e envie mensagens de teste para endereços autorizados.

**Confirmação de registo por código:** o ecrã de registo da aplicação já solicita um código OTP de 6 dígitos e valida-o com `supabase.auth.verifyOtp({ email, token, type: \"signup\" })`. Por isso, no modelo `confirmation.html`, mantenha `{{ .Token }}` visível no corpo da mensagem (não use `{{ .ConfirmationURL }}` para a confirmação de registo). Os restantes fluxos podem continuar a usar os links nativos, conforme o modelo correspondente.

## Remetente e entrega (SMTP)

O nome apresentado deve ser **RuJe IA**. Para envio real a todos os utilizadores, configure um fornecedor SMTP transaccional (por exemplo, Resend) e um domínio de envio que controla.

1. Crie uma conta no fornecedor SMTP e adicione/verifique um domínio seu (recomendação: um subdomínio dedicado, por exemplo `auth.rujeia.online`, se o fornecedor o aceitar).
2. Publique exactamente os registos DNS SPF e DKIM indicados pelo fornecedor; configure DMARC. Não invente valores DNS.
3. Obtenha no fornecedor o host SMTP, porta, utilizador e palavra-passe SMTP.
4. Abra [Authentication → SMTP Settings](https://supabase.com/dashboard/project/vlckoouduqhgmizkfwao/auth/smtp) e active SMTP personalizado:
   - Sender email: um endereço verificado no domínio, por exemplo `noreply@auth.rujeia.online`
   - Sender name: `RuJe IA`
   - SMTP host, port, username e password: os valores fornecidos pelo serviço SMTP.
5. Em [Authentication → URL Configuration](https://supabase.com/dashboard/project/vlckoouduqhgmizkfwao/auth/url-configuration), confirme:
   - Site URL: `https://rujeia.online`
   - Redirect URLs: `https://rujeia.online/**` e `https://www.rujeia.online/**`
6. Mantenha a confirmação de e-mail activa. Não active auto-confirm apenas para contornar falhas de entrega.
7. Faça testes de registo, reenvio de confirmação, recuperação de palavra-passe e alteração de e-mail. Confirme a recepção em Gmail e Outlook e verifique também spam.

## Limite importante

Os modelos estão versionados neste repositório, mas o projecto Supabase hospedado só passa a usá-los depois de os colar e guardar no Dashboard. A configuração SMTP também depende de credenciais de um fornecedor e de registos DNS do domínio. Estes segredos não devem ser colocados no GitHub, no código frontend ou enviados em conversas.

A Supabase documenta estes passos em https://supabase.com/docs/guides/auth/auth-smtp e https://supabase.com/docs/guides/local-development/customizing-email-templates.
