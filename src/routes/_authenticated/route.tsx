import { useEffect, useState } from "react";
import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Logo } from "@/components/Logo";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { applyTheme, readTheme, t, usePreferences } from "@/lib/preferences";
import { LogOut, Settings, CreditCard, ShieldCheck, LayoutDashboard } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useIsAdmin();
  const { lang } = usePreferences();
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    applyTheme(readTheme());
  }, []);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navBtn = "shrink-0 px-3";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-3">
          <Link to="/painel" className="w-fit shrink-0" aria-label="Ir para o painel">
            <Logo size="sm" />
          </Link>
          <nav
            aria-label="Navegação da conta"
            className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 sm:w-auto sm:overflow-visible sm:pb-0"
          >
            <Button asChild variant="brand" size="sm" className={navBtn}>
              <Link to="/painel">
                <LayoutDashboard className="h-4 w-4" /> {t(lang, "painel")}
              </Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="glass" size="sm" className={navBtn}>
                <Link to="/admin">
                  <ShieldCheck className="h-4 w-4" /> {t(lang, "admin")}
                </Link>
              </Button>
            )}
            <Button asChild variant="glass" size="sm" className={navBtn}>
              <Link to="/planos">
                <CreditCard className="h-4 w-4" /> {t(lang, "planos")}
              </Link>
            </Button>
            <Button asChild variant="glass" size="sm" className={navBtn}>
              <Link to="/definicoes">
                <Settings className="h-4 w-4" /> {t(lang, "definicoes")}
              </Link>
            </Button>
            <NotificationBell />
            <Button variant="danger" size="sm" className={navBtn} onClick={() => setConfirmOut(true)}>
              <LogOut className="h-4 w-4" /> {t(lang, "sair")}
            </Button>
          </nav>
        </div>
      </header>
      {confirmOut && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sair-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur-sm"
          onClick={() => setConfirmOut(false)}
        >
          <div
            className="shadow-soft w-full max-w-sm rounded-2xl border border-border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="sair-titulo" className="text-lg font-bold">{t(lang, "sairTitulo")}</h2>
            <p className="text-muted-foreground mt-2 text-sm">{t(lang, "sairTexto")}</p>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="glass" onClick={() => setConfirmOut(false)}>{t(lang, "cancelar")}</Button>
              <Button variant="danger" onClick={signOut}>{t(lang, "simSair")}</Button>
            </div>
          </div>
        </div>
      )}
      <Outlet />
    </div>
  );
}
