import {
  MonitorPlay, BarChart3, Sliders, ShieldCheck,
  QrCode, ListMusic, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import LeadDialog from "./LeadDialog";

const features = [
  { 
    icon: MonitorPlay, 
    title: "Pantalla con la marca de tu bar", 
    desc: "Muestra tu logo, tus colores y promociones como el 2x1 de la noche en la pantalla del bar." 
  },
  { 
    icon: Sliders, 
    title: "Control de la cola", 
    desc: "Ordena las canciones, salta las que no vayan con el ambiente y pausa la música desde tu celular." 
  },
  { 
    icon: ListMusic, 
    title: "Música de respaldo", 
    desc: "Cuando no hay pedidos, Repítela reproduce tu lista de YouTube para que el bar siga sonando." 
  },
  { 
    icon: BarChart3, 
    title: "Datos de canciones y horarios", 
    desc: "Conoce qué música prefieren tus clientes y en qué horarios hacen más pedidos." 
  },
  { 
    icon: ShieldCheck, 
    title: "Límites por mesa y PIN", 
    desc: "Define cuántas canciones puede pedir cada mesa y activa un PIN diario cuando lo necesites." 
  },
  { 
    icon: QrCode, 
    title: "Códigos QR listos para imprimir", 
    desc: "Descarga los códigos QR con el logo de tu bar para ponerlos en mesas, cartas o en la barra." 
  },
];

const ForBars = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="para-bares" className="py-20 sm:py-28 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-14 sm:mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs font-bold text-orange-400 mb-4 border border-primary/30">
            <span>Para dueños y administradores</span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-white">
            Todo lo que necesitas para que <br />
            <span className="text-gradient">tu bar suene y venda mejor</span>
          </h2>
          <p className="text-zinc-200 text-base sm:text-lg">
            Controla la música, promociona productos y deja que tu equipo se concentre en atender las mesas.
          </p>
        </div>

        {/* Features Grid */}
        <div
          ref={ref}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {features.map((f) => (
            <div 
              key={f.title} 
              className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-white/15 hover:border-primary/50 transition-all duration-300 hover:-translate-y-1.5 group flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-5 group-hover:bg-primary/25 transition-colors">
                  <f.icon className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2.5">{f.title}</h3>
                <p className="text-sm text-zinc-200 leading-relaxed font-medium">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Bar: Demo Request Modal */}
        <div className="text-center mt-12 sm:mt-16">
          <LeadDialog location="for_bars">
            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-bold text-base md:text-lg px-8 py-6 sm:py-7 rounded-2xl shadow-glow-primary transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Sparkles className="w-5 h-5 mr-2" />
              Pide una demo
            </Button>
          </LeadDialog>
        </div>
      </div>
    </section>
  );
};

export default ForBars;
