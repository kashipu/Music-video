import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";

const faqs = [
  {
    q: "¿Necesito descargar alguna app?",
    a: "No. Todo funciona desde el navegador de tu celular. Escaneas el QR y listo, sin instalaciones.",
  },
  {
    q: "¿Cuántas canciones puedo pedir?",
    a: "Hasta 5 canciones cada 30 minutos. Esto puede variar dependiendo del bar. Puedes cancelar canciones que aún no se han reproducido.",
  },
  {
    q: "¿Puedo pegar un link de YouTube directamente?",
    a: "Sí. Puedes buscar por nombre/artista o pegar directamente un link de YouTube.",
  },
  {
    q: "¿Cómo sé cuándo suena mi canción?",
    a: "Ves tu posición en la cola en tiempo real y recibes una notificación cuando tu canción empieza a sonar.",
  },
  {
    q: "¿Qué necesita el bar para tener Repitela?",
    a: "Solo una pantalla con navegador (Smart TV, laptop, tablet) y conexión a internet. Se configura en minutos y no requiere instalación de software.",
  },
  {
    q: "¿Cuánto cuesta para el bar?",
    a: "$60.000 pesos al mes, todo incluido. Sin costos ocultos, sin límites de canciones.",
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
