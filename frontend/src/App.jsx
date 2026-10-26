import Header from './components/Header';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import KnowMore from './components/KnowMore';
import RiskAnalysis from './components/RiskAnalysis';
import SurvivorStories from './components/SurvivorStories';
import Chatbot from './components/Chatbot';
import Footer from './components/Footer';

export default function App() {
  return (
    <>
      <Header />
      <Navbar />
      <Hero />
      <KnowMore />
      <Features />
      <RiskAnalysis />
      <SurvivorStories />
      <Chatbot />
      <Footer />
    </>
  );
}
