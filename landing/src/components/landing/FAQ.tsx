import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import { HelpCircle } from "lucide-react";

const faqs = [
  {
    q: "¿Necesito comprar pantallas o equipos especiales para mi bar?",
    a: "No. Puedes usar cualquier Smart TV con navegador web integrado, un televisor conectado por HDMI a un computador portátil, o un dispositivo como Fire TV Stick, Xiaomi Stick o Chromecast. Solo necesitas conexión a internet.",
  },
  {
    q: "¿Mis clientes tienen que descargar alguna aplicación en su celular?",
    a: "No. Todo funciona desde el navegador web móvil (Safari, Chrome, etc.). El cliente escanea el código QR de su mesa y accede de inmediato. No requiere descargar apps pesadas ni ingresar tarjetas de crédito.",
  },
  {
    q: "¿Qué pasa si un cliente pide una canción inapropiada para el bar?",
    a: "Tú y tu equipo tienen control absoluto desde el panel de administración en tu celular o PC. Con un solo toque puedes saltar la canción, eliminarla, pausar o reorganizar el orden de la cola con arrastrar y soltar.",
  },
  {
    q: "¿Qué sucede si nadie pide música durante unos minutos?",
    a: "Repítela incluye una Playlist de Respaldo automática. Cuando la cola se vacía, el sistema reproduce sin interrupciones tu lista musical precargada en YouTube para que tu bar nunca se quede en silencio.",
  },
  {
    q: "¿Cómo obtengo los códigos QR para las mesas?",
    a: "Desde el panel de administración puedes generar y descargar un PDF listo para imprimir en alta resolución con el logo, nombre y colores de tu bar para colocar en stickers, individuales o cartas.",
  },
  {
    q: "¿Cómo se realiza el pago de la suscripción mensual?",
    a: "El costo es de $50.000 COP al mes. Puedes pagar a través de Nequi, Daviplata, transferencia Bancolombia o tarjeta de crédito. No hay contratos de permanencia ni cobros automáticos obligatorios.",
  },
];

const faqStructuredData = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(({ q, a }) => ({
    "@type": "Question",
    name: q,
    acceptedAnswer: { "@type": "Answer", text: a },
  })),
};

const FAQ = () => {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="faq" className="py-20 sm:py-28 relative overflow-hidden">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqStructuredData) }}
      />
      <div className="container mx-auto px-4 sm:px-6 max-w-4xl relative z-10">
        <div className="text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-2 glass-card px-4 py-1.5 rounded-full text-xs font-bold text-orange-400 mb-4 border border-primary/30">
            <HelpCircle className="w-3.5 h-3.5" />
            Resolvemos tus dudas
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold mb-4 leading-tight text-white">
            Preguntas <span className="text-gradient">Frecuentes</span>
          </h2>
          <p className="text-zinc-200 text-base sm:text-lg">
            Todo lo que necesitas saber antes de modernizar la música de tu local.
          </p>
        </div>

        <div
          ref={ref}
          className={`transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
        >
          <Accordion type="single" collapsible className="space-y-3 sm:space-y-4">
            {faqs.map((faq, i) => (
              <AccordionItem 
                key={i} 
                value={`faq-${i}`} 
                className="glass-card rounded-xl sm:rounded-2xl px-5 sm:px-6 py-1 border border-white/15 overflow-hidden transition-all data-[state=open]:border-primary/50 data-[state=open]:bg-white/10"
              >
                <AccordionTrigger className="text-left text-base md:text-lg font-bold text-white hover:no-underline hover:text-orange-400 py-4">
                  {faq.q}
                </AccordionTrigger>
                <AccordionContent className="text-zinc-100 text-sm md:text-base leading-relaxed pb-4 font-normal">
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
