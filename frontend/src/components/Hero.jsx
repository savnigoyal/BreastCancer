import { useMemo } from 'react';

export default function Hero() {
  const particles = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      animationDuration: `${6 + Math.random() * 10}s`,
      animationDelay: `${Math.random() * 8}s`,
      size: `${3 + Math.random() * 4}px`,
      opacity: 0.2 + Math.random() * 0.3,
    }));
  }, []);

  const scrollToInfo = () => {
    const el = document.getElementById('info');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="hero" id="hero">
      {/* Floating particles */}
      <div className="hero__particles">
        {particles.map((p) => (
          <div
            key={p.id}
            className="hero__particle"
            style={{
              left: p.left,
              width: p.size,
              height: p.size,
              animationDuration: p.animationDuration,
              animationDelay: p.animationDelay,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      <h2 className="hero__title">Your Health. Our Intelligence.</h2>

      <button className="hero__cta" onClick={scrollToInfo}>
        Know More About Breast Cancer
      </button>

    </section>
  );
}
