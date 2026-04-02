import { Music, Phone, MessageCircle, Instagram } from "lucide-react";

const Footer = () => {
  return (
    <footer className="border-t border-border/30 py-12">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-bold text-gradient">Repitela</span>
          </div>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#como-funciona" className="hover:text-foreground transition-colors">Como Funciona</a>
            <a href="#para-bares" className="hover:text-foreground transition-colors">Para Bares</a>
            <a href="#precio" className="hover:text-foreground transition-colors">Precio</a>
            <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <a href="https://instagram.com/repitela.musica" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Instagram className="h-4 w-4" />
              @repitela.musica
            </a>
            <a href="https://wa.me/573028336170" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </a>
            <a href="tel:+573028336170" className="flex items-center gap-1.5 hover:text-primary transition-colors">
              <Phone className="h-4 w-4" />
              302 833 6170
            </a>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Repitela. Hecho en Colombia.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
