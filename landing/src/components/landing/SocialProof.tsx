import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { Clock, Music, Shield, TrendingUp, Star, Quote } from "lucide-react";

const stats = [
  { 
    icon: TrendingUp, 
    value: "+35%", 
    label: "Mayor Permanencia", 
    desc: "Las mesas se quedan más tiempo esperando su canción y piden rondas extra." 
  },
  { 
    icon: Clock, 
    value: "< 30s", 
    label: "Registro Rápido", 
    desc: "El cliente abre la cámara, escanea y pide. Cero fricción, cero descargas." 
  },
  { 
    icon: Music, 
    value: "100%", 
    label: "Música Continua", 
    desc: "Playlist de respaldo que suena automáticamente si la cola se vacía." 
  },
  { 
    icon: Shield, 
    value: "$50.000", 
    label: "COP al Mes", 
    desc: "Precio fijo y transparente. Todo incluido, sin comisiones ni sorpresas." 
  },
];

const cities = [
  "Bogotá D.C.", "Medellín", "Cali", "Cartagena"
];

const SocialProof = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-20 sm:py-28 relative overflow-hidden border-y border-white/10 bg-brand-card/40">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        
        {/* City Ticker */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="text-xs uppercase tracking-widest font-extrabold text-orange-400 mb-4">
            Presente en bares y gastrobares de Colombia
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 max-w-4xl mx-auto">
            {cities.map((city) => (
              <span 
                key={city} 
                className="text-xs sm:text-sm font-semibold bg-white/10 border border-white/20 px-4 py-1.5 rounded-full text-zinc-100 shadow-sm"
              >
                📍 {city}
              </span>
            ))}
          </div>
        </div>

        {/* Stats Grid */}
        <div
          ref={ref}
          className={`grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 transition-all duration-700 max-w-5xl mx-auto ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          {stats.map((stat) => (
            <div 
              key={stat.label} 
              className="p-5 sm:p-7 rounded-2xl sm:rounded-3xl glass-card border border-white/15 hover:border-primary/50 transition-all duration-300 group"
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center mb-4 group-hover:bg-primary/25 transition-colors">
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-orange-400" />
              </div>
              <div className="text-3xl sm:text-4xl font-black text-white mb-1.5 tracking-tight font-display">
                {stat.value}
              </div>
              <div className="text-sm font-extrabold text-zinc-100 mb-1.5">{stat.label}</div>
              <div className="text-xs text-zinc-300 leading-relaxed hidden sm:block font-medium">{stat.desc}</div>
            </div>
          ))}
        </div>

        {/* Testimonial Quote */}
        <div className={`mt-14 sm:mt-20 max-w-3xl mx-auto text-center transition-all duration-700 delay-200 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}>
          <div className="glass-card rounded-3xl p-6 sm:p-10 border border-white/15 relative">
            <Quote className="w-8 h-8 sm:w-10 sm:h-10 text-primary/30 absolute top-5 left-5 -scale-x-100" />
            <div className="flex justify-center gap-1 mb-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm sm:text-base md:text-lg text-zinc-100 font-medium italic mb-5 leading-relaxed relative z-10 px-2 sm:px-6">
              "Antes la gente llamaba al mesero a cada rato para que cambiara la música o peleaban por el Spotify. Con Repítela las mesas están felices eligiendo sus canciones y el consumo en cerveza y cócteles subió notablemente porque nadie se quiere ir antes de que suene su tema."
            </p>
            <div className="text-sm font-bold text-white">
              Andrés Morales
            </div>
            <div className="text-xs text-orange-300 font-semibold mt-0.5">
              Administrador de Gastrobar en Medellín, Antioquia
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default SocialProof;
