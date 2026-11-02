import { Link } from "@tanstack/react-router";
import { BookOpen, Plus, GraduationCap, History, CreditCard } from "lucide-react";

const base = "relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2.5 text-white/80 transition-all duration-300 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";
const active = "bg-white/20 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_4px_14px_rgba(0,0,0,0.08)] after:absolute after:left-1/2 after:top-1 after:h-1 after:w-7 after:-translate-x-1/2 after:rounded-full after:bg-[#c8f7d8] after:shadow-[0_0_10px_rgba(200,247,216,0.9)]";

export function MobileBottomNav() {
  return (
    <nav aria-label="Navegação principal" className="ruje-liquid-nav print:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
        <Link to="/painel" className={base} activeProps={{ className: active }}><BookOpen className="h-5 w-5" /><span className="text-[10px] font-semibold">Início</span></Link>
        <Link to="/novo-trabalho" className={base} activeProps={{ className: active }}><Plus className="h-5 w-5" /><span className="text-[10px] font-semibold">Criar</span></Link>
        <Link to="/exames" className={base} activeProps={{ className: active }}><GraduationCap className="h-5 w-5" /><span className="text-[10px] font-semibold">Exames</span></Link>
        <Link to="/historico" className={base} activeProps={{ className: active }}><History className="h-5 w-5" /><span className="text-[10px] font-semibold">Histórico</span></Link>
        <Link to="/planos" className={base} activeProps={{ className: active }}><CreditCard className="h-5 w-5" /><span className="text-[10px] font-semibold">Planos</span></Link>
      </div>
    </nav>
  );
}
