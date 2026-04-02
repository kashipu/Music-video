import { Button } from "@/components/ui/button";
import { Play, Zap } from "lucide-react";
import Particles from "./Particles";

const Hero = () => {
  return (
    <section aria-label="Repitela - jukebox digital para bares" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[150px]" />
      <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-secondary/8 blur-[120px]" />

      <Particles />

      <div className="relative z-10 container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: Copy */}
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 glass-card glow-sm rounded-full px-5 py-2.5 mb-8 animate-fade-up">
              <Zap className="h-4 w-4 text-yellow-400" />
              <span className="text-sm text-muted-foreground">Sin app. Sin descargas. Todo en tiempo real.</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 animate-fade-up leading-tight" style={{ animationDelay: "0.1s" }}>
              La Musica
              <br />
              <span className="text-gradient">la Pones Tu</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 animate-fade-up leading-relaxed" style={{ animationDelay: "0.2s" }}>
              Tus clientes escanean el QR, se registran, buscan su cancion y automaticamente se encola en la lista del bar.
              <span className="text-foreground font-medium"> Tu solo disfrutas.</span>
            </p>

            <div className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
              <Button size="lg" className="bg-primary text-primary-foreground text-lg px-8 py-6 glow" asChild>
                <a href="#para-bares">
                  <Play className="h-5 w-5 mr-2" />
                  Lleva Repitela a tu bar
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-8 md:gap-12 animate-fade-up" style={{ animationDelay: "0.5s" }}>
              {[
                { value: "0", label: "Descargas necesarias" },
                { value: "30s", label: "Tiempo de setup" },
                { value: "24/7", label: "Musica sin parar" },
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                  <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Image */}
          <div className="hidden lg:flex justify-center animate-fade-up" style={{ animationDelay: "0.4s" }}>
            <div className="relative">
              <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full" />
              <div className="relative glass-card glow rounded-3xl p-1 border-primary/20 border overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&h=600&fit=crop&crop=center"
                  alt="Persona usando Repitela en su celular en un bar"
                  className="rounded-2xl w-[400px] h-[500px] object-cover"
                />
                {/* Floating card overlay */}
                <div className="absolute bottom-6 left-6 right-6 glass-card rounded-2xl p-4 border-primary/20 border">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-lg">🎵</span>
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-foreground">Despacito — Luis Fonsi</div>
                      <div className="text-xs text-primary">🔊 Sonando ahora en el bar</div>
                    </div>
                  </div>
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
