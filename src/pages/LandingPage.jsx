import Navbar from '../components/landing/Navbar.jsx';
import HeroSection from '../components/landing/HeroSection.jsx';
import FeaturesSection from '../components/landing/FeaturesSection.jsx';
import HowItWorksSection from '../components/landing/HowItWorksSection.jsx';
import ProductShowcaseSection from '../components/landing/ProductShowcaseSection.jsx';
import FaqSection from '../components/landing/FaqSection.jsx';
import Footer from '../components/landing/Footer.jsx';

export default function LandingPage() {
  return (
    <div className="ff-landing d-flex flex-column min-vh-100">
      <Navbar />
      <main className="flex-grow-1">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <ProductShowcaseSection />
        <FaqSection />
      </main>
      <Footer />
    </div>
  );
}
