import { Button } from "@/components/ui/button";
import { MessageCircle, Sparkles } from "lucide-react";
import { track } from "@/lib/analytics";

const CTAFinal = () => {
  return (
    <section className="py-20 sm:py-32 relative overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[600px] h-[300px] sm:h-[400px] bg-primary/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative container mx-auto px-4 sm:px-6 text-center max-w-3xl z-10">
        <div className="glass-card rounded-3xl sm:rounded-[3rem] p-8 sm:p-14 md:p-16 border-2 border-primary/40 shadow-glow-primary bg-gradient-to-b from-brand-card/95 via-brand-card/80 to-brand-card/95">
          <div className="inline-flex items-center gap-2 bg-primary/20 border border-primary/35 rounded-full px-4 py-1.5 mb-6 text-orange-200 text-xs font-bold">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Lista en 3 minutos
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white mb-6 leading-tight font-display">
            Tus clientes piden la música. <br />
            <span className="text-gradient">Tu equipo vende más.</span>
          </h2>

          <p className="text-zinc-100 max-w-xl mx-auto mb-10 text-base sm:text-lg md:text-xl leading-relaxed">
            Repítela recibe las canciones desde el QR de cada mesa y tú mantienes el control.
            <br />
            <span className="text-white font-black">$50.000 COP/mes. Sin contratos ni cláusulas.</span>
          </p>

          <div className="flex justify-center max-w-md mx-auto">
            <Button size="lg" className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-base md:text-lg py-6 sm:py-7 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]" asChild>
              <a href="https://wa.me/573028336170?text=Hola%2C%20quiero%20llevar%20Repitela%20a%20mi%20bar" target="_blank" rel="noopener noreferrer" onClick={() => track("repitela_landing_whatsapp_click", { location: "cta_final" })}>
                <MessageCircle className="h-5 w-5 mr-2.5 shrink-0" />
                Pide una demo
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTAFinal;
