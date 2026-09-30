import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { LogOut, User, CreditCard, ShieldCheck } from "lucide-react";

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

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-5 sm:py-3">
          <Link to="/painel" className="w-fit shrink-0" aria-label="Ir para o painel">
            <Logo size="sm" />
          </Link>
          <nav aria-label="Navegação da conta" className="flex w-full min-w-0 items-center gap-1 overflow-x-auto pb-0.5 sm:w-auto sm:overflow-visible sm:pb-0">
            <Button asChild variant="ghost" size="sm" className="shrink-0 sm:hidden">
              <Link to="/painel">Painel</Link>
            </Button>
            {isAdmin && (
              <Button asChild variant="ghost" size="sm" className="shrink-0">
                <Link to="/admin">
                  <ShieldCheck className="h-4 w-4" /> Admin
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/planos">
                <CreditCard className="h-4 w-4" /> Planos
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/perfil">
                <User className="h-4 w-4" /> Perfil
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="shrink-0" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sair
            </Button>
          </nav>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
