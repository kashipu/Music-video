import { XCircle, CheckCircle2, Zap } from "lucide-react";

const comparisons = [
  {
    pain: "El mesero o bartender pierde tiempo cambiando canciones en Spotify o YouTube en vez de atender mesas.",
    gain: "100% en piloto automático: Tus clientes piden sus canciones desde la mesa sin distraer al personal.",
  },
  {
    pain: "Clientes frustrados porque piden canciones que nunca suenan o reclamos por 'quién tiene el cable AUX'.",
    gain: "Cola transparente y democrática: Todos ven en qué posición va su canción en la pantalla del bar.",
  },
  {
    pain: "Pantallas de TV apagadas o mostrando videos con comerciales molestos de YouTube que cortan el ambiente.",
    gain: "Pantalla Kiosk profesional 16:9 con tu logo, tus colores, banner de promociones y cero anuncios.",
  },
  {
    pain: "Silencios incómodos cuando se acaba una lista de reproducción o cuando se desconecta el celular del DJ.",
    gain: "Playlist de respaldo inteligente: si nadie pide música, suena tu lista favorita sin interrupciones.",
  },
];

const PainVsGain = () => {
  return (
    <section className="py-20 sm:py-28 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 relative z-10">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs font-bold text-orange-400 mb-4 border border-primary/30">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Evolución del Entretenimiento Nocturno
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-white">
            Deja de pelear con la música. <br />
            <span className="text-gradient">Haz que trabaje para tu bar.</span>
          </h2>
          <p className="text-zinc-200 text-base sm:text-lg">
            Descubre por qué los bares que modernizan su música aumentan el tiempo de estadía y el consumo por mesa.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-5xl mx-auto">
          {/* PAIN COLUMN */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-red-500/30 bg-red-950/20">
            <div className="flex items-center gap-3 pb-4 sm:pb-6 border-b border-white/10 mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-red-100">El Bar Tradicional</h3>
                <p className="text-xs text-red-200 font-medium">Fricción, quejas y pérdida de tiempo</p>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {comparisons.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-zinc-200 leading-relaxed font-medium">{item.pain}</p>
                </div>
              ))}
            </div>
          </div>

          {/* GAIN COLUMN */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 border-2 border-primary/50 bg-primary/10 relative shadow-glow-primary">
            <div className="hidden xs:block absolute top-4 right-4 bg-primary text-white text-xs font-black uppercase px-3 py-1 rounded-full tracking-wider shadow-sm">
              La Nueva Experiencia
            </div>

            <div className="flex items-center gap-3 pb-4 sm:pb-6 border-b border-white/10 mb-4 sm:mb-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/30 border border-primary/40 flex items-center justify-center text-white shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-extrabold text-white">Con Repítela</h3>
                <p className="text-xs text-orange-200 font-semibold">Control total, ambiente activo y más ventas</p>
              </div>
            </div>

            <div className="space-y-4 sm:space-y-6">
              {comparisons.map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-white font-semibold leading-relaxed">{item.gain}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PainVsGain;
