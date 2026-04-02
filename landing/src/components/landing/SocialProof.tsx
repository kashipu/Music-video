import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Star, Music, Users, Clock } from "lucide-react";

const stats = [
  { icon: Music, value: "Ilimitadas", label: "Canciones disponibles", desc: "Todo YouTube a disposicion" },
  { icon: Users, value: "Tiempo real", label: "Cola sincronizada", desc: "WebSockets, sin recargar" },
  { icon: Clock, value: "< 30 seg", label: "Setup completo", desc: "Crea tu bar y listo" },
  { icon: Star, value: "$60.000", label: "Pesos al mes", desc: "Sin letra chiquita" },
];

const SocialProof = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-20 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-primary/3 to-transparent" />
      <div className="container mx-auto px-4 relative">
        <div
          ref={ref}
          className={`grid grid-cols-2 md:grid-cols-4 gap-6 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="text-center p-6 rounded-2xl glass-card border-border/30 hover:border-primary/20 transition-all duration-300">
              <stat.icon className="h-6 w-6 text-primary mx-auto mb-3" />
              <div className="text-2xl md:text-3xl font-bold text-foreground mb-1">{stat.value}</div>
              <div className="text-sm font-medium text-foreground mb-1">{stat.label}</div>
              <div className="text-xs text-muted-foreground">{stat.desc}</div>
            </div>
          ))}
        </div>

        {/* Testimonial */}
        <div className={`mt-12 max-w-2xl mx-auto text-center transition-all duration-700 delay-200 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="glass-card rounded-2xl p-8 border-border/30">
            <div className="flex justify-center gap-1 mb-4">
              {[1,2,3,4,5].map(i => <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />)}
            </div>
            <p className="text-lg text-foreground italic mb-4">
              "Desde que pusimos Repitela la gente no para de pedir canciones. Se quedan mas tiempo y consumen mas. Es como tener un DJ que nunca descansa."
            </p>
            <div className="text-sm text-muted-foreground">
              — Dueño de bar en Colombia
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
