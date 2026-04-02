import { QrCode, UserPlus, Search, Music2 } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const steps = [
  {
    icon: QrCode,
    title: "Escanea el QR",
    desc: "Lo encuentras en la pantalla del bar, en tu mesa o en un cartel. Ábrelo con la cámara de tu celular.",
  },
  {
    icon: UserPlus,
    title: "Regístrate en segundos",
    desc: "Solo necesitas tu nombre y número de celular. Sin apps, sin descargas, todo desde el navegador.",
  },
  {
    icon: Search,
    title: "Busca tu canción",
    desc: "Busca por nombre, artista o pega directamente un link de YouTube. Encuentra lo que quieras escuchar.",
  },
  {
    icon: Music2,
    title: "¡Suena en el bar!",
    desc: "Tu canción entra a la cola. Ves en qué posición está y recibes una notificación cuando empieza a sonar.",
  },
];

const HowItWorks = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="como-funciona" className="py-24 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            ¿Cómo <span className="text-gradient">Funciona</span>?
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            4 pasos y ya estás poniendo tu música favorita en el bar
          </p>
        </div>

        <div
          ref={ref}
          className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-5xl mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {steps.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-[60%] w-[calc(100%-20%)] h-px bg-gradient-to-r from-primary/30 to-transparent" />
              )}
              <div className="relative z-10 w-16 h-16 rounded-2xl glass-card border-primary/20 border flex items-center justify-center mb-4">
                <step.icon className="h-7 w-7 text-primary" />
              </div>
              <div className="text-xs font-bold text-primary mb-1">Paso {i + 1}</div>
              <h4 className="font-semibold text-foreground mb-2">{step.title}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>

        {/* Extra info */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            { emoji: "⏱️", text: "Puedes pedir hasta 5 canciones cada 30 minutos" },
            { emoji: "❌", text: "Puedes cancelar canciones que aún no han sonado" },
            { emoji: "📲", text: "Recibes aviso cuando tu canción empieza a sonar" },
          ].map((tip) => (
            <div key={tip.text} className="glass-card rounded-xl p-4 text-center border-border/30">
              <div className="text-xl mb-2">{tip.emoji}</div>
              <p className="text-sm text-muted-foreground">{tip.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
