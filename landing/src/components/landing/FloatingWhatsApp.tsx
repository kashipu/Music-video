import { MessageCircle } from "lucide-react";
import { WHATSAPP_LINK } from "./LeadDialog";
import { track } from "@/lib/analytics";

const FloatingWhatsApp = () => {
  return (
    <aside aria-label="Soporte y contacto por WhatsApp" className="fixed bottom-5 right-4 sm:bottom-6 sm:right-6 z-50 flex items-center group">
      {/* Tooltip text pill */}
      <span className="hidden sm:inline-block mr-2.5 px-3.5 py-1.5 rounded-full glass-card bg-brand-dark/95 border border-emerald-500/40 text-xs font-bold text-emerald-300 shadow-xl opacity-90 group-hover:opacity-100 transition-opacity">
        ¿Dudas? Chatea con nosotros
      </span>

      {/* Floating Action Button */}
      <a
        href={WHATSAPP_LINK}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chatear por WhatsApp con un asesor de Repítela"
        onClick={() => track("repitela_landing_whatsapp_click", { location: "floating" })}
        className="relative flex items-center justify-center w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110 active:scale-95 focus:outline-none focus:ring-4 focus:ring-emerald-500/40"
      >
        {/* Radar Pulse Rings */}
        <span className="absolute -inset-1 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
        <span className="absolute -inset-2 rounded-full bg-emerald-500/10 pointer-events-none" />

        <MessageCircle className="w-7 h-7 text-white fill-current relative z-10" />
      </a>
    </aside>
  );
};

export default FloatingWhatsApp;
