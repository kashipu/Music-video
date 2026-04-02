import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Music } from "lucide-react";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const links = [
    { label: "Cómo Funciona", href: "#como-funciona" },
    { label: "Para tu Bar", href: "#para-bares" },
    { label: "Precio", href: "#precio" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav aria-label="Navegacion principal" className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/30">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <a href="#" className="flex items-center gap-2">
          <Music className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold text-gradient">Repitela</span>
        </a>

        <div className="hidden md:flex items-center gap-8">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {link.label}
            </a>
          ))}
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" asChild>
            <a href="#precio">Quiero Repitela en mi Bar</a>
          </Button>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isOpen && (
        <div className="md:hidden glass-card border-t border-border/30 px-4 pb-4">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="block py-3 text-sm text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(false)}>
              {link.label}
            </a>
          ))}
          <Button className="w-full mt-2 bg-primary text-primary-foreground" asChild>
            <a href="#precio">Quiero Repitela</a>
          </Button>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
