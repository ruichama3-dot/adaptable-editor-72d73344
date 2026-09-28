# Publicar a RuJe IA na Vercel

A ligação pública da conta e dos trabalhos já está incluída no código. Não é necessário configurar `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` ou variáveis `VITE_SUPABASE_*` na Vercel.

## Única variável necessária para gerar trabalhos

1. Abra [Google AI Studio](https://aistudio.google.com/app/apikey) com a sua conta Google.
2. Clique em **Create API key** e copie a chave criada.
3. Na Vercel, abra o projecto e aceda a **Settings → Environment Variables**.
4. Crie a variável `GEMINI_API_KEY` e cole a chave como valor.
5. Marque **Production**, **Preview** e **Development**.
6. Abra **Deployments**, escolha o último envio e clique em **Redeploy**.

## Importar e publicar

1. Envie este projecto para um repositório privado no GitHub.
2. Na Vercel, escolha **Add New → Project** e importe o repositório.
3. Mantenha as definições detectadas automaticamente.
4. Adicione `GEMINI_API_KEY` antes de publicar.

Nunca envie o ficheiro `.env` ao GitHub. O ficheiro `.env.example` contém apenas os nomes que podem ser usados, sem valores privados.