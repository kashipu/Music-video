import { Button } from "@/components/ui/button";
import { QrCode, Play, Zap } from "lucide-react";
import Particles from "./Particles";

const Hero = () => {
  return (
    <section aria-label="Repitela - jukebox digital para bares" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[120px]" />

      <Particles />

      <div className="relative z-10 container mx-auto px-4 text-center">
        {/* Trust badge */}
        <div className="inline-flex items-center gap-2 glass-card glow-sm rounded-full px-5 py-2.5 mb-8 animate-fade-up">
          <Zap className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-muted-foreground">Sin app. Sin descargas. Desde el celular.</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 animate-fade-up leading-tight" style={{ animationDelay: "0.1s" }}>
          La Musica
          <br />
          <span className="text-gradient">la Pones Tu</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-12 animate-fade-up leading-relaxed" style={{ animationDelay: "0.2s" }}>
          Tus clientes escanean el QR, buscan su cancion favorita y la escuchan sonar en tu bar.
          <span className="text-foreground font-medium"> Tu solo disfrutas.</span>
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <Button size="lg" className="bg-primary text-primary-foreground text-lg px-8 py-6 glow" asChild>
            <a href="#para-bares">
              <Play className="h-5 w-5 mr-2" />
              Lleva Repitela a tu bar
            </a>
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-8 py-6 border-border/50" asChild>
            <a href="#como-funciona">
              <QrCode className="h-5 w-5 mr-2" />
              Ver como funciona
            </a>
          </Button>
        </div>

        {/* Stats strip */}
        <div className="mt-16 flex flex-wrap items-center justify-center gap-8 md:gap-16 animate-fade-up" style={{ animationDelay: "0.5s" }}>
          {[
            { value: "0", label: "Descargas necesarias" },
            { value: "30s", label: "Tiempo de setup" },
            { value: "24/7", label: "Musica sin parar" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Phone mockup */}
        <div className="mt-16 max-w-sm mx-auto animate-fade-up animate-float" style={{ animationDelay: "0.6s" }}>
          <div className="glass-card glow rounded-3xl p-5 border-primary/20 border">
            <div className="bg-muted rounded-2xl p-5 space-y-3">
              <div className="text-center mb-4">
                <div className="text-2xl mb-1">🎵</div>
                <div className="text-sm font-semibold text-foreground">Cola en Bar La Esquina</div>
                <div className="text-xs text-muted-foreground">3 canciones en cola</div>
              </div>
              {[
                { pos: 1, song: "Despacito — Luis Fonsi", status: "🔊 Sonando" },
                { pos: 2, song: "Blinding Lights — The Weeknd", status: "Siguiente" },
                { pos: 3, song: "Bohemian Rhapsody — Queen", status: "En cola" },
              ].map((item) => (
                <div key={item.pos} className={`flex items-center gap-3 rounded-xl p-3 transition-all ${item.pos === 1 ? "bg-primary/15 border border-primary/30" : "bg-card/60 border border-border/30"}`}>
                  <span className={`text-xs font-bold ${item.pos === 1 ? "text-primary" : "text-muted-foreground"}`}>#{item.pos}</span>
                  <div className="flex-1 text-left">
                    <div className="text-xs text-foreground truncate">{item.song}</div>
                    <div className={`text-[10px] ${item.pos === 1 ? "text-primary" : "text-muted-foreground"}`}>{item.status}</div>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 text-center">
                  <span className="text-xs text-primary font-medium">+ Buscar cancion o pegar link</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
