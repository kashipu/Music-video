import { Button } from "@/components/ui/button";
import { Check, MessageCircle, Shield } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const features = [
  "Canciones ilimitadas de YouTube",
  "Cola en tiempo real con WebSockets",
  "Pantalla Kiosk sin branding de YouTube",
  "Playlist de respaldo automatica",
  "Panel de admin completo",
  "Analytics con GA4 integrado",
  "QR dinamico en pantalla y para imprimir",
  "Tu logo y colores en toda la app",
  "Gestion de usuarios y rate limiting",
  "Soporte por WhatsApp",
];

const Pricing = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="precio" className="py-24 relative">
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Un precio. <span className="text-gradient">Todo incluido.</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Tus clientes lo usan gratis. El bar paga un precio fijo mensual. Sin sorpresas.
          </p>
        </div>

        <div
          ref={ref}
          className={`max-w-lg mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="glass-card glow rounded-3xl p-8 md:p-10 border-primary/30 border-2">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-1.5 mb-4">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-primary">Sin contratos. Cancela cuando quieras.</span>
              </div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Repitela para tu Bar</h3>
              <p className="text-sm text-muted-foreground mb-6">El cliente no paga nada</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl md:text-6xl font-extrabold text-foreground">$60.000</span>
                <span className="text-muted-foreground text-lg"> /mes</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Pesos colombianos</p>
            </div>

            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button size="lg" className="w-full bg-primary text-primary-foreground text-lg py-6 glow" asChild>
              <a href="https://wa.me/573028336170?text=Hola%2C%20quiero%20Repitela%20en%20mi%20bar" target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-5 w-5 mr-2" />
                Contratar por WhatsApp
              </a>
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-4">
              Tambien puedes llamar al <a href="tel:+573028336170" className="text-primary hover:underline">302 833 6170</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
