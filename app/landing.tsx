'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { mountLandingTv } from '../src/landing/tv-stage';
import { createAudio } from '../src/audio';
import { useChannelNav } from './shell';

/* breaks match the wide layout; below 1400px they collapse back into one paragraph */
const LINES = [
  'Two Italians in Oslo, making things we wish existed.',
  'We turn ideas into brands, websites and digital experiences',
  'for startups and people building something new. We think,',
  'design, code, animate, experiment, and obsess over the little',
  'details. Small studio. Big curiosity.',
];

/* length of the push into the screen */
const DIVE_MS = 1150;

export default function Landing() {
  const stageRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const go = useChannelNav();
  const goRef = useRef(go);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    goRef.current = go;
  }, [go]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    /* Next keeps the page alive between visits: start clean every time we come back */
    busy.current = false;
    setLeaving(false);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    router.prefetch('/tv');
    const sound = createAudio(() => false);
    let alive = true;

    const enter = async () => {
      if (busy.current) return;
      busy.current = true;
      if (reduce) {
        goRef.current('/tv');
        return;
      }
      setLeaving(true);
      document.body.classList.add('is-diving');
      sound.sfx.click();
      window.setTimeout(() => alive && sound.sfx.static(DIVE_MS - 200), 140);
      const ok = await tv.dive(DIVE_MS);
      if (!alive) return;
      /* the viewport is already full of static: the Shell takes over at full cover */
      goRef.current('/tv', { from: ok ? 'dive' : undefined });
    };

    const tv = mountLandingTv(stage, { reduce, onActivate: enter });
    return () => {
      alive = false;
      tv.destroy();
      sound.close();
      document.body.classList.remove('is-diving');
      busy.current = false;
    };
  }, [router]);

  return (
    <div className={leaving ? 'landing is-leaving' : 'landing'}>
      <h1 className="landing-statement">
        <span className="landing-copy">
          {LINES.map((line, index) => (
            <Fragment key={line}>
              {index > 0 && <br className="landing-break" />}
              {line}
              {index < LINES.length - 1 ? ' ' : ''}
            </Fragment>
          ))}
        </span>
      </h1>
      <div
        ref={stageRef}
        className="landing-stage"
        role="link"
        tabIndex={0}
        aria-label="Open garpez.tv"
      />
    </div>
  );
}
