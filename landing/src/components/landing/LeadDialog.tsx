import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MessageCircle } from "lucide-react";
import { track } from "@/lib/analytics";

const WHATSAPP_NUMBER = "573028336170";

/** CTA directo: abre WhatsApp con el mensaje, sin formulario. */
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hola, quiero una demo de Repítela para mi bar"
)}`;

const fields = [
  { name: "nombre", placeholder: "Tu nombre", label: "Nombre" },
  { name: "bar", placeholder: "Nombre del bar", label: "Bar" },
  { name: "ciudad", placeholder: "Ciudad", label: "Ciudad" },
  { name: "direccion", placeholder: "Dirección del bar", label: "Dirección" },
];

const LeadDialog = ({
  children,
  location = "unknown",
}: {
  children: React.ReactNode;
  /** Sección desde la que se abre, para el reporte de GA4. */
  location?: string;
}) => {
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const text = [
      "Hola, quiero una demo de Repítela para mi bar.",
      ...fields.map((f) => `${f.label}: ${data.get(f.name)}`),
    ].join("\n");
    track("repitela_landing_lead_submitted", {
      location,
      ciudad: String(data.get("ciudad") ?? ""),
    });
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`,
      "_blank",
      "noopener"
    );
    setOpen(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (next) track("repitela_landing_demo_opened", { location });
    setOpen(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md glass-card bg-brand-card/95 border-white/15 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white font-display">
            Pide una demo de Repítela
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            Cuéntanos sobre tu bar. Te escribimos por WhatsApp para mostrarte
            la demo y el plan de $50.000 COP al mes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
          {fields.map((f) => (
            <Input
              key={f.name}
              name={f.name}
              required
              placeholder={f.placeholder}
              className="h-12 bg-white/5 border-white/15 rounded-xl"
            />
          ))}

          <Button
            type="submit"
            size="lg"
            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-bold py-6 rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <MessageCircle className="h-5 w-5 mr-2 shrink-0" />
            Enviar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LeadDialog;
