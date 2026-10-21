import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OrbitAvatar, { ORBIT_RADIUS, orbitPositions, type OrbitLink } from "./OrbitAvatar";

const links: OrbitLink[] = [
  { key: "github", label: "GitHub", href: "https://github.com/someone", icon: "github" },
  { key: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/someone", icon: "linkedin" },
  { key: "email", label: "Email", href: "mailto:someone@example.com", icon: "mail" },
];

describe("orbitPositions", () => {
  it("puts n points on the orbit, equally spaced, the first at the top", () => {
    const points = orbitPositions(3);
    expect(points).toHaveLength(3);
    // first point straight above the centre
    expect(points[0].x).toBeCloseTo(50, 2);
    expect(points[0].y).toBeCloseTo(50 - ORBIT_RADIUS, 2);
    for (const p of points) {
      expect(Math.hypot(p.x - 50, p.y - 50)).toBeCloseTo(ORBIT_RADIUS, 2);
    }
    // equal spacing: all pairwise chord lengths match (120 degrees apart)
    const chord = (a: number, b: number) => Math.hypot(points[a].x - points[b].x, points[a].y - points[b].y);
    expect(chord(0, 1)).toBeCloseTo(chord(1, 2), 2);
    expect(chord(1, 2)).toBeCloseTo(chord(2, 0), 2);
  });

  it("spaces the points evenly for any count (2 links are opposite each other)", () => {
    const [a, b] = orbitPositions(2);
    expect(a.x + b.x).toBeCloseTo(100, 2);
    expect(a.y + b.y).toBeCloseTo(100, 2);
    expect(orbitPositions(0)).toEqual([]);
  });
});

describe("OrbitAvatar", () => {
  it("renders one link per contact with its accessible name and href", () => {
    render(<OrbitAvatar name="Tien" avatarSrc={null} label="Contact links" links={links} />);
    const nav = screen.getByRole("navigation", { name: "Contact links" });
    const anchors = within(nav).getAllByRole("link");
    expect(anchors.map((a) => a.getAttribute("href"))).toEqual(links.map((l) => l.href));
    expect(within(nav).getByRole("link", { name: "GitHub" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "LinkedIn" })).toBeInTheDocument();
    expect(within(nav).getByRole("link", { name: "Email" })).toBeInTheDocument();
  });

  it("opens web links in a new tab safely and keeps mailto links in the same tab", () => {
    render(<OrbitAvatar name="Tien" avatarSrc={null} label="Contact links" links={links} />);
    const github = screen.getByRole("link", { name: "GitHub" });
    expect(github).toHaveAttribute("target", "_blank");
    expect(github.getAttribute("rel")).toContain("noopener");
    expect(github.getAttribute("rel")).toContain("noreferrer");
    expect(screen.getByRole("link", { name: "Email" })).not.toHaveAttribute("target");
  });

  it("places each link on the orbit with the computed percentages", () => {
    render(<OrbitAvatar name="Tien" avatarSrc={null} label="Contact links" links={links} />);
    const expected = orbitPositions(3);
    links.forEach((link, i) => {
      const anchor = screen.getByRole("link", { name: link.label });
      expect(anchor.style.left).toBe(`${expected[i].x}%`);
      expect(anchor.style.top).toBe(`${expected[i].y}%`);
    });
  });

  it("shows the avatar image with the person's name as alt text when one is set", () => {
    render(<OrbitAvatar name="Tien Nguyen" avatarSrc="/avatar.jpg" label="Contact links" links={links} />);
    const img = screen.getByRole("img", { name: "Tien Nguyen" });
    expect(img).toHaveAttribute("src", "/avatar.jpg");
  });

  it("shows a decorative placeholder (no broken image) when no avatar is set", () => {
    const { container } = render(<OrbitAvatar name="Tien" avatarSrc={null} label="Contact links" links={links} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img", { name: "Tien" })).toBeNull();
  });

  it("still renders without links (just the avatar and the orbit)", () => {
    render(<OrbitAvatar name="Tien" avatarSrc={null} label="Contact links" links={[]} />);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("marks the animated glow as removable for reduced motion", () => {
    const { container } = render(<OrbitAvatar name="Tien" avatarSrc={null} label="Contact links" links={links} />);
    const animated = Array.from(container.querySelectorAll("[class*='animate-']"));
    expect(animated.length).toBeGreaterThan(0);
    for (const el of animated) expect(el.className).toContain("motion-reduce:animate-none");
  });
});
