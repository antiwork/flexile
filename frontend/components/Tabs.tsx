"use client";
import { type Route } from "next";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export type TabLink<T extends string = string> = { label: string; route: Route<T> };

const Tabs = <T extends string>({ links }: { links: TabLink<T>[] }) => {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [clipPath, setClipPath] = useState("");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const containerClass = "grid grid-flow-col auto-cols-max gap-4";
  let activeIndex = -1;
  let activeSearch: URLSearchParams | null = null;
  for (const [i, link] of links.entries()) {
    const [path, searchStr] = link.route.split("?", 2);
    if (path && pathname !== path) continue;
    const search = searchStr == null ? null : new URLSearchParams(searchStr);
    if (
      search &&
      search.size > (activeSearch?.size ?? -1) &&
      [...search].every(([key, value]) => searchParams.get(key) === value)
    ) {
      activeSearch = search;
    } else if (activeIndex >= 0) continue;
    activeIndex = i;
  }
  if (activeIndex === -1) activeIndex = 0;
  const updateClipPath = () => {
    const activeTab = tabsRef.current?.children[activeIndex];
    if (!(activeTab instanceof HTMLElement)) return;
    setClipPath(`rect(0 ${activeTab.offsetLeft + activeTab.offsetWidth}px 100% ${activeTab.offsetLeft}px round 99px)`);
  };

  useEffect(() => {
    updateClipPath();
    void document.fonts.ready.then(updateClipPath);
  }, [pathname, links]);

  return (
    <div className="overflow-x-auto">
      <div ref={tabsRef} role="tablist" className={`relative min-w-max ${containerClass}`}>
        {links.map((link, i) => (
          <Link
            key={link.label}
            href={link.route}
            className="rounded-full px-3 py-2 text-inherit no-underline hover:bg-gray-50"
            role="tab"
            aria-selected={i === activeIndex}
          >
            {link.label}
          </Link>
        ))}
        <div
          className={`pointer-events-none absolute inset-0 bg-blue-600 text-white transition-all duration-300 ease-in-out ${containerClass}`}
          style={{ clipPath }}
        >
          {links.map((link) => (
            <div key={link.label} className="px-3 py-2">
              {link.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Tabs;
