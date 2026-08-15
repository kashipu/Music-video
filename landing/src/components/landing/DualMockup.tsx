import { useState, useEffect } from "react";
import { QrCode, Search, Sparkles, Play } from "lucide-react";
import SoundEqualizer from "./SoundEqualizer";

const DualMockup = () => {
  const [progress, setProgress] = useState(65);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => (prev >= 98 ? 10 : prev + 1));
    }, 600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full max-w-5xl mx-auto py-4 sm:py-8">
      {/* Glow Backdrops */}
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[260px] sm:w-[450px] h-[220px] sm:h-[280px] bg-primary/15 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/3 right-6 w-[180px] sm:w-[300px] h-[180px] sm:h-[240px] bg-secondary/15 rounded-full blur-[100px] pointer-events-none" />

      {/* Grid with clean, spacious layout */}
      <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-center">
        
        {/* =========================================
            1. KIOSK TV SCREEN (16:9 Aspect Video)
            ========================================= */}
        <div className="w-full lg:col-span-7 relative">
          <div className="relative rounded-2xl sm:rounded-3xl p-2 sm:p-3 bg-gradient-to-b from-white/15 to-white/0 border border-white/20 shadow-2xl backdrop-blur-xl">
            
            {/* TV Screen Container - Strictly 16:9 */}
            <div className="relative aspect-video w-full rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-white/15 shadow-2xl select-none">
              
              {/* Full Video Image - Karol G PROVENZA (Local HD asset) */}
              <img 
                src="/karol-g-provenza.jpg" 
                alt="Karol G - PROVENZA Video Oficial"
                className="absolute inset-0 w-full h-full object-cover object-center"
                loading="eager"
              />

              {/* Gradient overlays for crisp text readability without blocking the video */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/60 pointer-events-none" />

              {/* Minimal Top Header */}
              <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20 shadow-lg">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  <span className="text-xs sm:text-sm font-extrabold text-white tracking-wide">
                    Bar La Esquina
                  </span>
                </div>

                <div className="flex items-center gap-1.5 bg-black/80 border border-white/20 px-3 py-1.5 rounded-full backdrop-blur-md">
                  <SoundEqualizer size="sm" color="bg-primary" />
                  <span className="text-xs font-bold text-white tracking-wider">EN VIVO</span>
                </div>
              </div>

              {/* Clean Bottom Overlay Bar: Song Info + Mini QR */}
              <div className="absolute bottom-0 left-0 right-0 z-10 p-3 sm:p-4 bg-gradient-to-t from-black via-black/80 to-transparent">
                
                {/* Thin Progress Bar on top of bottom bar */}
                <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mb-2.5">
                  <div 
                    className="h-full bg-gradient-to-r from-primary via-orange-500 to-amber-400 transition-all duration-300 rounded-full"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  {/* Song Meta */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-1.5 text-xs text-amber-300 font-bold uppercase tracking-wide">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Sonando Ahora • Mesa 4</span>
                    </div>
                    <h3 className="text-sm sm:text-base md:text-lg font-black text-white truncate">
                      PROVENZA — Karol G
                    </h3>
                  </div>

                  {/* Clean Mini QR */}
                  <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 px-2 py-1.5 rounded-xl shrink-0">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-white rounded-md p-0.5 flex items-center justify-center">
                      <QrCode className="w-full h-full text-black" />
                    </div>
                    <div className="hidden sm:block text-left pr-0.5">
                      <div className="text-[10px] font-bold text-white uppercase leading-tight">Pide tu tema</div>
                      <div className="text-[9px] text-amber-300 font-semibold leading-tight">Escanea QR</div>
                    </div>
                  </div>
                </div>

              </div>

            </div>

            {/* Sub-label below TV */}
            <div className="flex items-center justify-between px-2 pt-2 text-xs text-zinc-300 font-medium">
              <span className="flex items-center gap-1.5 text-zinc-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                Pantalla Kiosk (Televisor) — Sin comerciales de YouTube
              </span>
              <span className="hidden sm:inline text-zinc-400">Smart TV & HDMI</span>
            </div>
          </div>
        </div>

        {/* =========================================
            2. CLIENT MOBILE PHONE
            ========================================= */}
        <div className="w-full lg:col-span-5 relative max-w-sm mx-auto">
          <div className="relative rounded-[2rem] p-2.5 sm:p-3 bg-gradient-to-b from-white/20 to-white/5 border border-white/20 shadow-2xl backdrop-blur-2xl">
            
            {/* Phone Screen Frame */}
            <div className="rounded-[1.6rem] bg-[#0c0d14] border border-white/15 p-4 flex flex-col gap-3 text-left text-white shadow-inner select-none">
              
              {/* Header */}
              <div className="flex items-center justify-between pb-2 border-b border-white/15">
                <span className="text-xs font-black text-white tracking-tight">Bar La Esquina</span>
                <span className="text-xs bg-primary/25 text-orange-200 border border-primary/40 px-2.5 py-0.5 rounded-full font-bold">
                  Mesa 4
                </span>
              </div>

              {/* Now Playing Banner with Karol G */}
              <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-3 shadow-sm">
                <div className="w-12 h-10 rounded-lg overflow-hidden shrink-0 bg-black relative">
                  <img 
                    src="/karol-g-provenza.jpg" 
                    alt="Karol G - PROVENZA" 
                    className="w-full h-full object-cover" 
                  />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <SoundEqualizer size="sm" color="bg-emerald-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                    <span className="text-[10px] font-extrabold text-emerald-300 uppercase tracking-wider">
                      Sonando ahora en el bar
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white truncate">PROVENZA — Karol G</div>
                  <div className="text-[11px] text-zinc-300 truncate">por Mesa 4 • Juan</div>
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <div className="w-full bg-white/10 border border-white/20 rounded-xl py-2.5 pl-8 pr-16 text-xs text-zinc-300 flex items-center">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5" />
                  <span className="truncate">Buscar en YouTube...</span>
                </div>
                <button className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-primary hover:bg-orange-600 text-white text-xs font-bold px-3 py-1 rounded-lg shadow-sm transition-colors">
                  Pedir
                </button>
              </div>

              {/* Queue List (2 clean items) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-zinc-200">
                  <span>Siguiente en la cola (2)</span>
                  <span className="text-xs text-orange-300 font-semibold">En vivo</span>
                </div>

                <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-white/20 text-xs font-bold text-white flex items-center justify-center shrink-0">
                    #1
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">Monastery — Ryan Castro, Feid</div>
                    <div className="text-[11px] text-zinc-300 truncate">Mesa 2 • Carlos</div>
                  </div>
                  <Play className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>

                <div className="p-2.5 rounded-xl bg-white/10 border border-white/15 flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-md bg-white/20 text-xs font-bold text-white flex items-center justify-center shrink-0">
                    #2
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-bold text-white truncate">Tití Me Preguntó — Bad Bunny</div>
                    <div className="text-[11px] text-zinc-300 truncate">Mesa 8 • Valentina</div>
                  </div>
                  <Play className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
              </div>

              <div className="pt-2 text-xs text-center text-zinc-400 border-t border-white/10 font-medium">
                app.repitela.com/bar-la-esquina • Sin apps
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default DualMockup;
