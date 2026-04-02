import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import SocialProof from "@/components/landing/SocialProof";
import HowItWorks from "@/components/landing/HowItWorks";
import ForBars from "@/components/landing/ForBars";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import CTAFinal from "@/components/landing/CTAFinal";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />
      <Hero />
      <SocialProof />
      <HowItWorks />
      <ForBars />
      <Pricing />
      <FAQ />
      <CTAFinal />
      <Footer />
    </div>
  );
};

export default Index;
