import { Button } from "@/components/ui/button";
import { Sparkles, Tv, Smartphone, ShieldCheck, ArrowDown } from "lucide-react";
import Particles from "./Particles";
import DualMockup from "./DualMockup";
import SoundEqualizer from "./SoundEqualizer";
import LeadDialog from "./LeadDialog";

const Hero = () => {
  return (
    <section aria-label="Repítela, rockola digital con QR para bares" className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-28 sm:pt-36 pb-16 sm:pb-24">
      {/* Background Lighting Gradients */}
      <div className="absolute inset-0 bg-radial-at-c from-brand-dark/0 via-brand-dark to-brand-dark pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[350px] sm:w-[700px] h-[300px] sm:h-[500px] rounded-full bg-primary/15 blur-[120px] sm:blur-[180px] pointer-events-none" />
      <div className="absolute top-1/3 right-4 sm:right-10 w-[200px] sm:w-[400px] h-[200px] sm:h-[400px] rounded-full bg-secondary/10 blur-[100px] sm:blur-[150px] pointer-events-none" />

      <Particles />

      <div className="relative z-10 container mx-auto px-4 sm:px-6 text-center max-w-6xl">
        {/* Top Floating Badge */}
        <div className="inline-flex items-center gap-2 sm:gap-2.5 glass-card glow-sm rounded-full px-4 sm:px-5 py-2 mb-8 sm:mb-10 animate-fade-up border border-primary/40 max-w-full">
          <SoundEqualizer size="sm" color="bg-primary" />
          <span className="text-xs sm:text-sm font-bold text-white truncate">
            Rockola digital con QR para bares 🇨🇴
          </span>
          <span className="bg-primary/30 text-orange-200 text-xs font-extrabold px-2 py-0.5 rounded-full uppercase shrink-0">
            v2.0
          </span>
        </div>

        {/* Main Title (H1) */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold mb-6 sm:mb-8 animate-fade-up leading-[1.15] sm:leading-[1.1] tracking-tight max-w-5xl mx-auto text-white">
          Tus clientes ponen la música. <br className="hidden sm:inline" />
          <span className="text-gradient">Tú vendes más, sin complicarte.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg md:text-xl text-zinc-200 max-w-3xl mx-auto mb-10 sm:mb-12 animate-fade-up leading-relaxed" style={{ animationDelay: "0.15s" }}>
          Repítela es una rockola digital con QR: tus clientes eligen canciones desde el celular y tu equipo controla la cola.
          <span className="text-white font-bold"> Todo por $50.000 COP al mes, sin contratos.</span>
        </p>

        {/* Action Buttons: Demo (Primary Orange) vs How it Works (Outline) */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-up mb-12 sm:mb-16 w-full max-w-md sm:max-w-none mx-auto" style={{ animationDelay: "0.25s" }}>
          <LeadDialog location="hero">
            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white text-base md:text-lg px-8 py-6 sm:py-7 rounded-2xl shadow-glow-primary font-bold transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Sparkles className="h-5 w-5 mr-2.5 shrink-0" />
              Pide una demo
            </Button>
          </LeadDialog>
          <Button size="lg" variant="outline" className="w-full sm:w-auto glass-card hover:bg-white/10 text-zinc-100 hover:text-white text-base md:text-lg px-8 py-6 sm:py-7 rounded-2xl border-white/20 font-bold" asChild>
            <a href="#como-funciona">
              <Tv className="h-5 w-5 mr-2 text-orange-400 shrink-0" />
              Cómo funciona
              <ArrowDown className="h-4 w-4 ml-1.5 opacity-80" />
            </a>
          </Button>
        </div>

        {/* Value Micro-Pills */}
        <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-zinc-200 font-medium mb-12 sm:mb-16 animate-fade-up" style={{ animationDelay: "0.35s" }}>
          <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full border-white/20">
            <Smartphone className="w-4 h-4 text-orange-400 shrink-0" />
            <span>Sin descargar aplicaciones</span>
          </div>
          <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full border-white/20">
            <Tv className="w-4 h-4 text-amber-400 shrink-0" />
            <span>TV o computador</span>
          </div>
          <div className="flex items-center gap-2 glass-card px-4 py-2 rounded-full border-white/20">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>$50.000 COP al mes</span>
          </div>
        </div>

        {/* Interactive Dual Mockup */}
        <div className="animate-fade-up w-full mt-4 sm:mt-6" style={{ animationDelay: "0.45s" }}>
          <DualMockup />
        </div>
      </div>
    </section>
  );
};

export default Hero;
