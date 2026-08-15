import { QrCode, Tv, Search, CheckCircle2, Sparkles } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: Tv,
    step: "01",
    title: "1. Conecta tu pantalla",
    desc: "Crea tu bar en 3 minutos. Abre el navegador en cualquier Smart TV, PC o tablet y entra a tu pantalla Kiosk.",
    badge: "Solo necesitas Internet",
  },
  {
    icon: QrCode,
    step: "02",
    title: "2. Clientes escanean el QR",
    desc: "Tus clientes apuntan con la cámara del celular al QR de su mesa. Se abre la web al instante sin descargar apps.",
    badge: "Cero descargas",
  },
  {
    icon: Search,
    step: "03",
    title: "3. ¡La música suena en vivo!",
    desc: "Buscan cualquier canción de YouTube, confirman su pedido y la pantalla del bar la reproduce en alta definición.",
    badge: "100% Automático",
  },
];

const HowItWorks = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="como-funciona" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs font-bold text-orange-400 mb-4 border border-primary/30">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Experiencia sin complicaciones
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-white">
            De la mesa a la pantalla <br />
            <span className="text-gradient">en 3 pasos sencillos</span>
          </h2>
          <p className="text-zinc-200 text-base sm:text-lg">
            Olvídate de instalaciones complicadas o cables auxiliares. Todo corre en la nube.
          </p>
        </div>

        {/* 3 Step Cards */}
        <div
          ref={ref}
          className={`grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {steps.map((step) => (
            <div 
              key={step.step} 
              className="relative glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/15 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1.5 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center group-hover:bg-primary/25 transition-colors">
                    <step.icon className="h-6 w-6 sm:h-7 sm:w-7 text-orange-400" />
                  </div>
                  <span className="text-3xl sm:text-4xl font-black text-white/30 font-display">
                    {step.step}
                  </span>
                </div>

                <div className="inline-block text-xs font-extrabold text-orange-200 bg-primary/25 border border-primary/40 px-3 py-1 rounded-md mb-3">
                  {step.badge}
                </div>

                <h3 className="text-lg sm:text-xl font-bold text-white mb-2 sm:mb-3">{step.title}</h3>
                <p className="text-sm text-zinc-200 leading-relaxed font-medium">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Feature Highlights Banner */}
        <div className="mt-12 sm:mt-16 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            { title: "Límites por mesa", desc: "Configura cuántas canciones puede pedir un usuario cada 30 min para evitar abusos." },
            { title: "Moderación en 1 clic", desc: "¿Una canción no va con la onda? Salta, pausa o reordena desde tu celular de admin." },
            { title: "Playlist anti-silencio", desc: "Si la cola queda vacía, suena automáticamente tu lista favorita precargada." },
          ].map((item) => (
            <div key={item.title} className="glass-card rounded-xl sm:rounded-2xl p-5 border border-white/15 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-white mb-1">{item.title}</div>
                <div className="text-xs text-zinc-200 leading-relaxed font-medium">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
