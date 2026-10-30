import { useRef, useState, type PointerEvent } from "react";
import { MessageCircle, Users, X, Grip } from "lucide-react";

const COMMUNITY_URL = "https://chat.whatsapp.com/CU2WmZIWDDvJURM2eqOtKT";
const SUPPORT_URL =
  "https://wa.me/258847296041?text=" +
  encodeURIComponent("Olá! Preciso de ajuda com a RuJe IA.");

/** Botão flutuante de WhatsApp, reposicionável com rato ou toque. */
export function WhatsAppFloat() {
  const [open, setOpen] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragStart = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const moved = useRef(false);

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    dragStart.current = {
      x: event.clientX,
      y: event.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!dragStart.current) return;
    const dx = event.clientX - dragStart.current.x;
    const dy = event.clientY - dragStart.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 5) moved.current = true;
    if (!moved.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const minX = 12 - (rect.left - offset.x);
    const maxX = window.innerWidth - 12 - rect.right + offset.x;
    const minY = 12 - (rect.top - offset.y);
    const maxY = window.innerHeight - 12 - rect.bottom + offset.y;
    setOffset({
      x: Math.min(maxX, Math.max(minX, dragStart.current.offsetX + dx)),
      y: Math.min(maxY, Math.max(minY, dragStart.current.offsetY + dy)),
    });
  }

  function onPointerUp() {
    dragStart.current = null;
  }

  return (
    <div
      className="pointer-events-none fixed right-3 bottom-3 z-40 flex flex-col items-end gap-3 print:hidden sm:right-5 sm:bottom-5 [&>*]:pointer-events-auto"
      style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` }}
    >
      {open && (
        <div className="flex flex-col gap-2">
          <a href={COMMUNITY_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-foreground shadow-[0_8px_28px_rgba(20,60,35,0.16)] backdrop-blur-2xl transition-transform hover:scale-105">
            <Users className="h-4 w-4 text-primary" /> Aderir à comunidade
          </a>
          <a href={SUPPORT_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-full border border-white/70 bg-white/80 px-4 py-2.5 text-sm font-semibold text-foreground shadow-[0_8px_28px_rgba(20,60,35,0.16)] backdrop-blur-2xl transition-transform hover:scale-105">
            <MessageCircle className="h-4 w-4 text-primary" /> Falar com o suporte
          </a>
        </div>
      )}
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={() => { if (!moved.current) setOpen((v) => !v); }}
        aria-label={open ? "Fechar opções de WhatsApp" : "Mover ou abrir opções de WhatsApp"}
        title="Arraste para mover · toque para abrir"
        className="grid h-14 w-14 touch-none select-none place-items-center rounded-full border border-white/35 bg-[linear-gradient(145deg,rgba(42,190,105,0.96),rgba(15,132,69,0.96))] text-white shadow-[0_12px_32px_rgba(22,131,74,0.34),inset_0_1px_1px_rgba(255,255,255,0.45)] backdrop-blur-2xl transition-[box-shadow,transform] hover:scale-105 hover:shadow-[0_16px_38px_rgba(22,131,74,0.42)] active:scale-95"
      >
        <span className="relative grid place-items-center">
          {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          <Grip className="absolute -right-3 -top-3 h-3 w-3 opacity-65" />
        </span>
      </button>
    </div>
  );
}
