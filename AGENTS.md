<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep RuJe IA's public data-service URL and publishable key in `src/integrations/supabase/config.ts`; this lets GitHub/Vercel builds authenticate without private environment files.
- Keep all private provider keys server-only in deployment environment settings; `.env` files must never be committed.
