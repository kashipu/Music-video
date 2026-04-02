import {
  MonitorPlay, BarChart3, ListMusic, Settings,
  QrCode, Palette, ListVideo, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const benefits = [
  { icon: ListMusic, title: "Cola de música en vivo", desc: "Tus clientes eligen, tú solo disfrutas. La cola se gestiona sola." },
  { icon: MonitorPlay, title: "Pantalla Kiosk dedicada", desc: "Conecta cualquier TV. Reproduce sin UI de YouTube, con controles propios y pre-buffering." },
  { icon: QrCode, title: "QR dinámico", desc: "Se muestra en pantalla automáticamente. Imprímelo para mesas. Configurable desde el panel." },
  { icon: Settings, title: "Control total", desc: "Pausa, salta, reordena. Drag & drop en la cola. Expulsa usuarios si es necesario." },
  { icon: BarChart3, title: "Analytics completos", desc: "Top artistas, horas pico, canciones por día, skip rate. Todo medible, todo en tu panel." },
  { icon: ListVideo, title: "Playlist de respaldo", desc: "Cuando la cola está vacía, suena tu playlist. Importa desde YouTube. Nunca hay silencio." },
  { icon: Users, title: "Gestión de mesas", desc: "Ve quién pidió qué, desde qué mesa. Resetea límites, controla la experiencia." },
  { icon: Palette, title: "Tu marca, tu estilo", desc: "Logo, colores y nombre de tu bar en la pantalla, el registro y la app del cliente." },
];

const ForBars = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="para-bares" className="py-24 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-primary font-medium">🍺 Para dueños de bares</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Lleva <span className="text-gradient">Repitela</span> a tu Bar
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Dale a tus clientes el poder de elegir la música. Tú mantienes el control total desde un panel de administración completo.
          </p>
        </div>

        {/* How it works for bars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto my-12">
          {[
            { step: "1", title: "Crea tu bar", desc: "Configura nombre, logo, colores y reglas en minutos" },
            { step: "2", title: "Conecta una pantalla", desc: "Abre la vista Kiosk en tu TV — Smart TV, laptop, lo que sea" },
            { step: "3", title: "Tus clientes eligen", desc: "Escanean el QR y empiezan a pedir canciones al instante" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-sm font-bold text-primary">{s.step}</span>
              </div>
              <h4 className="font-semibold text-foreground mb-1">{s.title}</h4>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div
          ref={ref}
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {benefits.map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-5 border-border/30 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-1 text-sm">{f.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <Button size="lg" className="bg-primary text-primary-foreground text-lg px-8 py-6" asChild>
            <a href="#precio">Ver Precio</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ForBars;
