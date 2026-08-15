import { Button } from "@/components/ui/button";
import { Check, MessageCircle, ShieldCheck, Sparkles } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { track } from "@/lib/analytics";

const features = [
  "Canciones y búsquedas ilimitadas en YouTube",
  "Pantalla para tus televisores",
  "Cola de canciones en tiempo real",
  "Panel de control desde celular o computador",
  "Música automática cuando no hay pedidos",
  "Anuncios para promocionar productos del bar",
  "Datos de canciones y horarios de mayor actividad",
  "Códigos QR personalizados para imprimir",
  "Límites por mesa y PIN opcional",
  "Soporte por WhatsApp",
];

const Pricing = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="precio" className="py-20 sm:py-28 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs font-bold text-orange-400 mb-4 border border-primary/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Un plan simple
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-white">
            Un precio fijo. <span className="text-gradient">Todo incluido.</span>
          </h2>
          <p className="text-zinc-200 text-base sm:text-lg max-w-xl mx-auto font-medium">
            Tus clientes piden canciones gratis desde el celular. Tú pagas $50.000 COP al mes, sin contratos ni comisiones.
          </p>
        </div>

        <div
          ref={ref}
          className={`max-w-lg mx-auto transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <div className="glass-card rounded-3xl sm:rounded-[2.5rem] p-6 sm:p-10 md:p-12 border-2 border-primary/50 shadow-glow-primary relative overflow-hidden">
            {/* Top Ribbon */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/40 rounded-full px-4 py-1.5 mb-6 text-emerald-300 text-xs font-bold max-w-full">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Sin permanencia. Cancela cuando quieras.</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-1 font-display">
                Repítela para tu bar
              </h3>
              <p className="text-xs sm:text-sm text-zinc-300 mb-6 font-medium">
                Rockola digital con QR, control y música de respaldo
              </p>

              {/* Price Tag */}
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-5xl sm:text-6xl font-black text-white tracking-tight font-display">
                  $50.000
                </span>
                <span className="text-lg sm:text-xl font-bold text-orange-400">COP /mes</span>
              </div>
              <p className="text-xs text-zinc-300 mt-2 font-medium">
                Aproximadamente $1.667 al día
              </p>
            </div>

            {/* Checklist with pure high contrast */}
            <div className="space-y-3.5 mb-10 py-6 border-y border-white/15">
              {features.map((f) => (
                <div key={f} className="flex items-center gap-3 text-sm text-zinc-100 font-medium">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/25 text-emerald-400 flex items-center justify-center shrink-0">
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </div>
                  <span>{f}</span>
                </div>
              ))}
            </div>

            {/* WhatsApp Single Focused CTA */}
            <Button size="lg" className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold text-base md:text-lg py-6 sm:py-7 rounded-2xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]" asChild>
              <a 
                href="https://wa.me/573028336170?text=Hola%2C%20quiero%20activar%20Repitela%20en%20mi%20bar%20por%2050.000%20al%20mes" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2.5"
                onClick={() => track("repitela_landing_whatsapp_click", { location: "pricing" })}
              >
                <MessageCircle className="h-5 w-5 shrink-0" />
                Pide una demo
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
