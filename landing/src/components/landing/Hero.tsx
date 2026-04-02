import { Button } from "@/components/ui/button";
import { QrCode, Smartphone } from "lucide-react";
import Particles from "./Particles";

const Hero = () => {
  return (
    <section aria-label="Repitela - jukebox digital para bares" className="relative min-h-screen flex items-center justify-center overflow-hidden pt-16">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/8 blur-[120px]" />

      <Particles />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="inline-flex items-center gap-2 glass-card rounded-full px-4 py-2 mb-8 animate-fade-up">
          <Smartphone className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">Desde tu celular, sin descargar nada</span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 animate-fade-up" style={{ animationDelay: "0.1s" }}>
          La Música
          <br />
          <span className="text-gradient">la Pones Tú</span>
        </h1>

        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          ¿Estás en un bar con Repitela? Escanea el QR, busca tu canción favorita y escúchala sonar en el bar. Así de fácil, desde tu celular.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up" style={{ animationDelay: "0.3s" }}>
          <Button size="lg" className="bg-primary text-primary-foreground text-lg px-8 py-6" asChild>
            <a href="#como-funciona">
              <QrCode className="h-5 w-5 mr-2" />
              Descubre como funciona
            </a>
          </Button>
        </div>

        {/* Phone mockup */}
        <div className="mt-20 max-w-sm mx-auto animate-fade-up animate-float" style={{ animationDelay: "0.5s" }}>
          <div className="glass-card rounded-3xl p-5 border-primary/20 border">
            <div className="bg-muted rounded-2xl p-5 space-y-3">
              <div className="text-center mb-4">
                <div className="text-2xl mb-1">🎵</div>
                <div className="text-sm font-semibold text-foreground">Tu Cola en Bar La Esquina</div>
                <div className="text-xs text-muted-foreground">3 canciones pendientes</div>
              </div>
              {[
                { pos: 1, song: "Despacito — Luis Fonsi", status: "🔊 Sonando" },
                { pos: 2, song: "Blinding Lights — The Weeknd", status: "Siguiente" },
                { pos: 3, song: "Bohemian Rhapsody — Queen", status: "En cola" },
              ].map((item) => (
                <div key={item.pos} className={`flex items-center gap-3 rounded-xl p-3 ${item.pos === 1 ? "bg-primary/15 border border-primary/30" : "bg-card/60 border border-border/30"}`}>
                  <span className={`text-xs font-bold ${item.pos === 1 ? "text-primary" : "text-muted-foreground"}`}>#{item.pos}</span>
                  <div className="flex-1 text-left">
                    <div className="text-xs text-foreground truncate">{item.song}</div>
                    <div className={`text-[10px] ${item.pos === 1 ? "text-primary" : "text-muted-foreground"}`}>{item.status}</div>
                  </div>
                </div>
              ))}
              <div className="pt-2">
                <div className="bg-card/60 border border-border/30 rounded-xl p-3 text-center">
                  <span className="text-xs text-muted-foreground">🔍 Buscar canción o pegar link de YouTube...</span>
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
