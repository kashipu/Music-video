import { Button } from "@/components/ui/button";
import { MessageCircle, Phone } from "lucide-react";

const CTAFinal = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />

      <div className="relative container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-6">
          Tu bar merece
          <br />
          <span className="text-gradient">mejor musica</span>
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-10 text-lg">
          Tus clientes eligen. Tu controlas. Todos disfrutan.
          <br />
          <span className="text-foreground font-medium">$50.000/mes. Sin contratos.</span>
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" className="bg-primary text-primary-foreground text-lg px-10 py-7 glow" asChild>
            <a href="https://wa.me/573028336170?text=Hola%2C%20quiero%20Repitela%20en%20mi%20bar" target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-5 w-5 mr-2" />
              Escribenos por WhatsApp
            </a>
          </Button>
          <Button size="lg" variant="outline" className="text-lg px-10 py-7 border-border/50" asChild>
            <a href="tel:+573028336170">
              <Phone className="h-5 w-5 mr-2" />
              302 833 6170
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
};

export default CTAFinal;
