/**
 * Avatar framed like a sun, with the contact links orbiting it like small planets.
 *
 * Geometry (all in percent of the square box, centre at 50/50):
 *   - sun frame: diameter 55%
 *   - orbit ring: radius ORBIT_RADIUS (concentric with the frame)
 *   - planets (contact links): diameter 17%, centred on the ring, spaced 360/n degrees apart, first one at the top
 * Purely decorative layers are aria-hidden; every link keeps a real accessible name and a >= 44px target.
 */

export const ORBIT_RADIUS = 41;

export type OrbitIcon = "github" | "linkedin" | "mail";

export interface OrbitLink {
  key: string;
  label: string;
  href: string;
  icon: OrbitIcon;
}

export interface OrbitAvatarProps {
  /** Person's name, used as the avatar's alt text. */
  name: string;
  /** Public path or URL of the avatar image; null shows a neutral placeholder. */
  avatarSrc: string | null;
  /** Accessible name of the group of contact links. */
  label: string;
  links: OrbitLink[];
}

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** `count` points equally spaced on the orbit, the first straight above the centre. */
export function orbitPositions(count: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / count;
    return {
      x: round3(50 + ORBIT_RADIUS * Math.cos(angle)),
      y: round3(50 + ORBIT_RADIUS * Math.sin(angle)),
    };
  });
}

function Icon({ name }: { name: OrbitIcon }) {
  const common = { "aria-hidden": true, focusable: false, className: "h-1/2 w-1/2" } as const;
  if (name === "github") {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" {...common}>
        <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
      </svg>
    );
  }
  if (name === "linkedin") {
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" {...common}>
        <rect x="2.5" y="8.5" width="4" height="13" rx="0.8" />
        <circle cx="4.5" cy="4.4" r="2.3" />
        <path d="M9.5 8.5h3.8v1.8c.7-1.2 2.1-2.1 4-2.1 3.6 0 4.2 2.4 4.2 5.4v7.4h-4v-6.5c0-1.5 0-3.2-2-3.2s-2.2 1.5-2.2 3.1v6.6h-3.8z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...common}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M3.5 7.5l8.5 6 8.5-6" />
    </svg>
  );
}

function Placeholder() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="h-full w-full text-on-surface-variant/55">
      <rect width="100" height="100" fill="currentColor" fillOpacity="0.08" />
      <circle cx="50" cy="38" r="15" fill="currentColor" />
      <path d="M20 92c0-17 13-29 30-29s30 12 30 29z" fill="currentColor" />
    </svg>
  );
}

export default function OrbitAvatar({ name, avatarSrc, label, links }: OrbitAvatarProps) {
  const positions = orbitPositions(links.length);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px] lg:max-w-[380px]">
      {/* Soft halo behind the sun (decorative, slow pulse; off for reduced motion) */}
      <div
        aria-hidden="true"
        className="absolute inset-[10%] rounded-full bg-primary-container/30 blur-3xl animate-[pulse_6s_ease-in-out_infinite] motion-reduce:animate-none"
      />

      {/* Orbit ring and a faint inner corona, concentric with the avatar frame */}
      <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="absolute inset-0 h-full w-full">
        <circle cx="50" cy="50" r={ORBIT_RADIUS} fill="none" className="stroke-outline-variant" strokeWidth="0.35" strokeDasharray="1.2 2.2" />
        <circle cx="50" cy="50" r="30.5" fill="none" className="stroke-primary-container/25" strokeWidth="0.3" />
      </svg>

      {/* The "sun": avatar frame with a gradient rim */}
      <div className="absolute left-1/2 top-1/2 aspect-square w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-primary-container via-primary to-secondary p-[3px] shadow-[0_0_44px_-6px_rgb(128_131_255/0.6)]">
        <div className="h-full w-full overflow-hidden rounded-full bg-surface-container-low">
          {avatarSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- local static avatar, no optimizer needed
            <img src={avatarSrc} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Placeholder />
          )}
        </div>
      </div>

      {/* Contact links, one per planet. The nav lets clicks through everywhere except on the planets. */}
      <nav aria-label={label} className="pointer-events-none absolute inset-0">
        {links.map((link, i) => {
          const external = /^https?:/i.test(link.href);
          return (
            <a
              key={link.key}
              href={link.href}
              aria-label={link.label}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              style={{ left: `${positions[i].x}%`, top: `${positions[i].y}%` }}
              className="group pointer-events-auto absolute flex aspect-square min-h-11 min-w-11 w-[17%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-outline-variant bg-surface-container text-on-surface-variant shadow-lg shadow-black/30 transition-colors hover:border-secondary hover:text-secondary focus-visible:border-secondary focus-visible:text-secondary motion-reduce:transition-none"
            >
              <Icon name={link.icon} />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-full mt-1.5 whitespace-nowrap rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-0.5 font-mono text-label-mono-xs text-on-surface opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
              >
                {link.label}
              </span>
            </a>
          );
        })}
      </nav>
    </div>
  );
}
