import { Music, MessageCircle, Instagram } from "lucide-react";
import SoundEqualizer from "./SoundEqualizer";
import { track } from "@/lib/analytics";

const Footer = () => {
  return (
    <footer className="border-t border-white/15 py-12 sm:py-16 bg-brand-darker relative z-10">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8 pb-10 border-b border-white/10">
          {/* Logo */}
          <div className="flex items-center gap-3 text-center sm:text-left">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-orange-500 flex items-center justify-center text-white shrink-0">
              <Music className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl text-white tracking-tight font-display">Repítela</span>
                <SoundEqualizer size="sm" color="bg-primary" />
              </div>
              <span className="text-xs text-zinc-300 font-medium tracking-wide block">
                Rockola digital con QR para bares
              </span>
            </div>
          </div>

          {/* Nav Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-zinc-200 font-medium">
            <a href="#como-funciona" className="hover:text-white transition-colors">Cómo funciona</a>
            <a href="#para-bares" className="hover:text-white transition-colors">Para bares</a>
            <a href="#precio" className="hover:text-white transition-colors">Precio</a>
            <a href="#faq" className="hover:text-white transition-colors">Preguntas</a>
            <a href="https://app.repitela.com/admin" target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">Panel</a>
          </div>

          {/* Social / Contact */}
          <div className="flex items-center gap-3 text-xs font-semibold text-zinc-100">
            <a 
              href="https://instagram.com/repitela.musica" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-center gap-2 glass-card bg-white/10 border-white/20 px-4 py-2.5 rounded-xl hover:text-white hover:border-primary/50 transition-colors"
            >
              <Instagram className="h-4 w-4 text-orange-400" />
              @repitela.musica
            </a>
            <a 
              href="https://wa.me/573028336170"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("repitela_landing_whatsapp_click", { location: "footer" })}
              className="flex items-center gap-2 glass-card bg-white/10 border-white/20 px-4 py-2.5 rounded-xl hover:text-white hover:border-emerald-500/50 transition-colors"
            >
              <MessageCircle className="h-4 w-4 text-emerald-400" />
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-zinc-300 gap-4 text-center sm:text-left font-medium">
          <div>
            © {new Date().getFullYear()} Repítela. Todos los derechos reservados.
          </div>
          <div className="flex items-center gap-2 text-zinc-200">
            <span>Hecho con pasión en Colombia 🇨🇴</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
