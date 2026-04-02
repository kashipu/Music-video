import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const faqs = [
  {
    q: "Necesito descargar alguna app?",
    a: "No. Todo funciona desde el navegador de tu celular. Escaneas el QR y listo, sin instalaciones.",
  },
  {
    q: "Cuantas canciones puedo pedir?",
    a: "Varias canciones por sesion. El limite lo configura cada bar. Puedes cancelar canciones que aun no se han reproducido.",
  },
  {
    q: "Como se cuanto falta para que suene mi cancion?",
    a: "Ves tu posicion en la cola en tiempo real y recibes una notificacion cuando tu cancion empieza a sonar.",
  },
  {
    q: "Que necesita el bar para tener Repitela?",
    a: "Solo internet y una pantalla con navegador (Smart TV, laptop, tablet). Se configura en minutos y no requiere instalacion de software.",
  },
  {
    q: "Cuanto cuesta para el bar?",
    a: "$50.000 pesos al mes, todo incluido. Sin contratos, sin costos ocultos. Cancela cuando quieras.",
  },
  {
    q: "El cliente tiene que pagar algo?",
    a: "No. El servicio es completamente gratis para los clientes del bar. Solo el bar paga la suscripcion mensual.",
  },
];

const FAQ = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="faq" className="py-24">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Preguntas <span className="text-gradient">Frecuentes</span>
          </h2>
        </div>

        <div
          ref={ref}
          className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="glass-card rounded-xl px-6 border-none">
                <AccordionTrigger className="text-left text-foreground hover:no-underline">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default FAQ;
