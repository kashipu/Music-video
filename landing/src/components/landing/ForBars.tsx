import {
  MonitorPlay, BarChart3, ListMusic, Settings,
  QrCode, ListVideo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const benefits = [
  { icon: ListMusic, title: "Cola en tiempo real", desc: "Tus clientes eligen canciones desde su celular. La cola se actualiza al instante para todos." },
  { icon: MonitorPlay, title: "Pantalla de video personalizada", desc: "Proyecta la musica en tus televisores con tu logo, tus colores y mensajes para tus clientes." },
  { icon: QrCode, title: "QR en pantalla", desc: "El QR aparece automaticamente en la pantalla. Tus clientes lo escanean y empiezan a pedir." },
  { icon: Settings, title: "Control total", desc: "Pausa, salta, reordena. Tu decides que suena y cuando. Expulsa usuarios si es necesario." },
  { icon: BarChart3, title: "Datos de la musica", desc: "Conoce que canciones son las mas pedidas, en que horarios y por que usuarios." },
  { icon: ListVideo, title: "Playlist de respaldo", desc: "Cuando nadie ha pedido canciones, suena tu playlist. Nunca hay silencio en tu bar." },
];

const ForBars = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="para-bares" className="py-24 relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-6">
            <span className="text-sm text-primary font-medium">Para duenos de bares</span>
          </div>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Todo lo que necesitas para que
            <br />
            <span className="text-gradient">tu bar suene increible</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Solo necesitas internet y tener Repitela. Si tienes televisores en el bar, puedes proyectar mensajes y el QR para que las personas puedan pedir la musica.
          </p>
        </div>

        {/* 3-step setup */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto my-12">
          {[
            { step: "1", title: "Crea tu bar", desc: "Nombre, logo y colores en 5 minutos" },
            { step: "2", title: "Conecta una pantalla", desc: "Smart TV, laptop, tablet — lo que tengas" },
            { step: "3", title: "Tus clientes eligen", desc: "Escanean el QR y empiezan a pedir" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto mb-3">
                <span className="text-lg font-bold text-primary">{s.step}</span>
              </div>
              <h4 className="font-semibold text-foreground mb-1">{s.title}</h4>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Features grid */}
        <div
          ref={ref}
          className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {benefits.map((f) => (
            <div key={f.title} className="glass-card rounded-2xl p-6 border-border/30 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 group">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-3 group-hover:bg-primary/20 transition-colors">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h4 className="font-semibold text-foreground mb-2">{f.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        <p className="text-center text-muted-foreground mt-8 text-sm">Y mucho mas: banner publicitario, gestion de usuarios, rate limiting, tema personalizable...</p>

        <div className="text-center mt-8">
          <Button size="lg" className="bg-primary text-primary-foreground text-lg px-8 py-6 glow" asChild>
            <a href="#precio">Ver Precio</a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default ForBars;
