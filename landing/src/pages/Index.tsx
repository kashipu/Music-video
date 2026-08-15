import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import SocialProof from "@/components/landing/SocialProof";
import PainVsGain from "@/components/landing/PainVsGain";
import HowItWorks from "@/components/landing/HowItWorks";
import ForBars from "@/components/landing/ForBars";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTAFinal from "@/components/landing/CTAFinal";
import Footer from "@/components/landing/Footer";
import FloatingWhatsApp from "@/components/landing/FloatingWhatsApp";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-primary/30 selection:text-white">
      <Navbar />
      <main className="overflow-x-hidden">
        <Hero />
        <SocialProof />
        <PainVsGain />
        <HowItWorks />
        <ForBars />
        <Pricing />
        <FAQ />
        <CTAFinal />
      </main>
      <Footer />
      <FloatingWhatsApp />
    </div>
  );
};

export default Index;
