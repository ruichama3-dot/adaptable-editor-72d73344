import { useState } from "react";
import { MessageCircle, Users, X } from "lucide-react";

const COMMUNITY_URL = "https://chat.whatsapp.com/CU2WmZIWDDvJURM2eqOtKT";
const SUPPORT_URL =
  "https://wa.me/258847296041?text=" +
  encodeURIComponent("Olá! Preciso de ajuda com a RuJe IA.");

/** Botão flutuante de WhatsApp: comunidade e suporte. */
export function WhatsAppFloat() {
  const [open, setOpen] = useState(false);

  return (
    <div className="pointer-events-none fixed right-3 bottom-3 z-40 flex flex-col items-end gap-3 print:hidden sm:right-5 sm:bottom-5 [&>*]:pointer-events-auto">
      {open && (
        <div className="flex flex-col gap-2">
          <a
            href={COMMUNITY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shadow-brand flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold text-foreground border border-border transition-transform hover:scale-105"
          >
            <Users className="h-4 w-4 text-primary" /> Aderir à comunidade
          </a>
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shadow-brand flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold text-foreground border border-border transition-transform hover:scale-105"
          >
            <MessageCircle className="h-4 w-4 text-primary" /> Falar com o suporte
          </a>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fechar opções de WhatsApp" : "Abrir opções de WhatsApp"}
        className="shadow-brand bg-brand grid h-14 w-14 place-items-center rounded-full text-primary-foreground transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
