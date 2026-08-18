import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X, Sparkles } from "lucide-react";
import LeadDialog from "./LeadDialog";
import logo from "@/assets/logo-color-negativo.svg";

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const links = [
    { label: "Cómo funciona", href: "#como-funciona" },
    { label: "Para tu bar", href: "#para-bares" },
    { label: "Precio", href: "#precio" },
    { label: "Preguntas", href: "#faq" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "glass-card border-b border-white/15 bg-brand-dark/95 backdrop-blur-xl shadow-lg"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="container mx-auto px-4 sm:px-6 h-16 sm:h-18 flex items-center justify-between gap-3 py-2 sm:py-3">
        {/* Brand Logo */}
        <a href="#" className="group shrink-0">
          <div className="flex flex-col">
            <img src={logo} alt="Repítela" className="h-7 md:h-5 lg:h-8 w-auto transition-transform group-hover:scale-[1.02]" />
            <span className="text-xs text-zinc-300 font-medium tracking-wide hidden xs:inline">
              Rockola digital con QR
            </span>
          </div>
        </a>

        {/* Desktop Nav Links */}
        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-4 lg:gap-8">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-zinc-200 hover:text-white transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Action CTA: Demo Request Modal */}
        <div className="hidden md:flex items-center gap-4">
          <a
            href="https://app.repitela.com/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-zinc-200 hover:text-white px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/30 transition-colors"
          >
            Entrar al panel
          </a>
          <LeadDialog location="navbar">
            <Button className="bg-gradient-to-r from-primary to-orange-500 hover:opacity-90 text-white font-bold text-xs lg:text-sm px-4 lg:px-5 py-2.5 rounded-xl shadow-glow-primary transition-all hover:shadow-lg">
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Pide una demo
            </Button>
          </LeadDialog>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className="md:hidden p-2 rounded-xl text-white hover:bg-white/10 transition-colors focus:outline-none"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isOpen}
        >
          {isOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="md:hidden glass-card border-t border-white/15 bg-brand-dark/95 backdrop-blur-2xl px-5 py-6 space-y-4 animate-fade-up shadow-2xl">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="block py-2.5 text-base font-medium text-zinc-100 hover:text-white transition-colors active:text-white"
              onClick={() => setIsOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-4 border-t border-white/15 space-y-3">
            <a
              href="https://app.repitela.com/admin"
              className="block text-center text-sm font-semibold text-zinc-200 py-2 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              Entrar al panel
            </a>
            <LeadDialog location="navbar_mobile">
              <Button className="w-full bg-gradient-to-r from-primary to-orange-500 text-white font-bold py-3.5 rounded-xl shadow-glow-primary">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Pide una demo
              </Button>
            </LeadDialog>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
