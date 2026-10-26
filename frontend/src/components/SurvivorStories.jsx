import { useEffect, useRef } from 'react';

const videos = [
  {
    title: 'Breast Cancer Survivor Story 1',
    youtubeId: 'q8j_vZRZKx0',
  },
  {
    title: 'Breast Cancer Survivor Story 2',
    youtubeId: '2iVECZgfwW4',
  },
  {
    title: 'Breast Cancer Survivor Story 3',
    youtubeId: 'EAvYD7bK4AA',
  },
];

export default function SurvivorStories() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
      },
      { threshold: 0.15 }
    );

    const cards = sectionRef.current?.querySelectorAll('.anim-in');
    cards?.forEach((card) => observer.observe(card));

    return () => observer.disconnect();
  }, []);

  return (
    <section className="section" id="stories" ref={sectionRef}>
      <h2 className="section__title">Survivor Stories</h2>
      <p className="section__subtitle">Hope, courage and strength — real stories from real survivors</p>

      <div className="stories__grid">
        {videos.map((v, i) => (
          <div
            key={v.youtubeId}
            className="story-video-card anim-in"
            style={{ transitionDelay: `${i * 0.12}s` }}
          >
            <div className="story-video-card__wrapper">
              <iframe
                src={`https://www.youtube.com/embed/${v.youtubeId}`}
                title={v.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
            <h3 className="story-video-card__title">{v.title}</h3>
          </div>
        ))}
      </div>
    </section>
  );
}
