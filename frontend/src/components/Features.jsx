import { useEffect, useRef } from 'react';

const features = [
  {
    icon: '🔍',
    title: 'Detection',
    desc: 'AI cancer detection',
  },
];

export default function Features() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-view');
          }
        });
      },
      { threshold: 0.15 }
    );

    const cards = sectionRef.current?.querySelectorAll('.anim-in');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="section" id="features" ref={sectionRef}>
      <h2 className="section__title">Our Features</h2>
      <p className="section__subtitle">
        Comprehensive AI-powered breast cancer screening tools at your fingertips
      </p>

      <div className="features__grid">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="feature-card anim-in"
            style={{ transitionDelay: `${i * 0.12}s` }}
          >
            <div className="feature-card__icon">{f.icon}</div>
            <h3 className="feature-card__title">{f.title}</h3>
            <p className="feature-card__desc">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
