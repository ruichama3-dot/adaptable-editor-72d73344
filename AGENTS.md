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
- Keep the owner-provided sample in versioned source and use it for both viewing and prefill, so GitHub/Vercel deployments show the same reference without database seed timing.
- Use manifest-only installation and retire the old caching worker; caching authenticated pages could expose stale private work on a shared device.
- Export editable work as real DOCX from the browser and retain page breaks; HTML disguised as .doc is unreliable in mobile office apps.
- Style user-facing actions with the shared button variants (`brand` for the main green action, `glass` for secondary transparent actions, `danger` for destructive ones) instead of per-page colour classes, so one theme change updates every screen.


- The project-local Unslop design skill is installed at `.agents/skills/unslop/`. Use it for future UI polish and redesign tasks. Preserve RuJe IA official logo, green/white identity, existing content, routes, data flows, and working functionality. Keep dashboard/app chrome neutral and reserve strong green for the brand accent and one intentional content moment. Follow the skill audit and verification checklist; do not add paid image-generation or browser-test dependencies without approval. Credit Damir Sokolovsky and link https://github.com/heydamir/unslop when redistributing or adapting the skill.
