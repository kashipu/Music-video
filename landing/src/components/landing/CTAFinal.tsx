import { Button } from "@/components/ui/button";
import { Music } from "lucide-react";

const CTAFinal = () => {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />

      <div className="relative container mx-auto px-4 text-center">
        <h2 className="text-3xl md:text-5xl font-bold mb-6">
          ¿Listo para que tus clientes
          <br />
          <span className="text-gradient">pongan la música</span>?
        </h2>
        <p className="text-muted-foreground max-w-lg mx-auto mb-10 text-lg">
          Contrata Repitela para tu bar. Tus clientes lo usan gratis desde su celular.
        </p>
        <Button size="lg" className="bg-primary text-primary-foreground text-lg px-10 py-7">
          <Music className="h-5 w-5 mr-2" />
          Quiero Repitela — $60.000/mes
        </Button>
        <p className="text-sm text-muted-foreground mt-4">
          Pago a la llave <span className="text-foreground font-mono font-bold">@WMV645</span>
        </p>
      </div>
    </section>
  );
};

export default CTAFinal;
