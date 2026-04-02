import { Button } from "@/components/ui/button";
import { Check, CreditCard } from "lucide-react";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const features = [
  
  "Canciones ilimitadas",
  "Cola en tiempo real con WebSockets",
  "Pantalla Kiosk con pre-buffering",
  "Playlist de respaldo desde YouTube",
  "Panel de admin completo",
  "Analytics detallados con GA4",
  "QR dinámico en pantalla y para imprimir",
  "Personalización de marca (logo, colores)",
  "Gestión de mesas y usuarios",
  "Soporte dedicado",
];

const Pricing = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="precio" className="py-24 relative">
      <div className="absolute bottom-0 left-1/4 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px]" />

      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Precio para <span className="text-gradient">tu Bar</span>
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Tus clientes lo usan gratis. El bar paga un precio fijo mensual, todo incluido.
          </p>
        </div>

        <div
          ref={ref}
          className={`max-w-lg mx-auto transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <div className="glass-card rounded-3xl p-8 md:p-10 border-primary/30 border-2">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold text-foreground mb-2">Repitela para tu Bar</h3>
              <p className="text-sm text-muted-foreground mb-6">El cliente no paga nada — todo va por el bar</p>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl md:text-6xl font-extrabold text-foreground">$60.000</span>
                <span className="text-muted-foreground text-lg"> /mes</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Pesos colombianos · Para el bar</p>
            </div>

            <ul className="space-y-3 mb-8">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-sm text-muted-foreground">
                  <Check className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Button size="lg" className="w-full bg-primary text-primary-foreground text-lg py-6" asChild>
              <a href="https://wa.me/573001234567?text=Hola%2C%20quiero%20Repitela%20en%20mi%20bar" target="_blank" rel="noopener noreferrer">
                Contratar Ahora
              </a>
            </Button>

            <div className="mt-6 glass-card rounded-xl p-4 text-center border-border/30">
              <div className="flex items-center justify-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Pago por Nequi / Daviplata / Transferencia</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enviar a la llave: <span className="text-foreground font-mono font-bold">@WMV645</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;
