import { Music } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border/30 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-bold text-gradient-neon">Repitela</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Cómo Funciona</a>
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#precios" className="hover:text-foreground transition-colors">Precios</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>

          <p className="text-sm text-muted-foreground">
            Hecho con 🎵 en Latinoamérica
          </p>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Repitela. Todos los derechos reservados.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
