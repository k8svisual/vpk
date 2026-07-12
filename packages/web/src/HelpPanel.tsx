import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ExternalLink, ChevronDown, ChevronRight, ArrowRight, type LucideIcon } from 'lucide-react';
import { HELP_TOPICS, searchHelp, type HelpImage, type HelpTopic } from './helpContent';
import { CommandBlock } from './CommandBlock';
import { VpkIcon } from './VpkIcon';

/**
 * Right-hand slide-out Help panel, structured as a Table of Contents + expandable sections (all in one scroll):
 *
 *  - A **Contents** index near the top lists every topic in two groups — "Screens" and "General & reference".
 *    Clicking an entry expands that topic's card and scrolls it into view. The current screen's entry is marked
 *    "this view". This is the primary way to jump around now that each topic is comprehensive.
 *  - Below the index, the CURRENT screen's topic is pinned and auto-expanded ("screen specific help"), then the
 *    other screen topics, then the general/reference topics — each an expandable card.
 *  - Typing in the search box searches across every topic (title/summary/sections/fields/crossLinks/commands/
 *    links — see searchHelp) and replaces the index+cards with a flat, selectable results list, so you can find
 *    help for a screen OTHER than the one you're on. The Contents index is hidden while searching.
 *
 * `screenIcons` is App.tsx's own VIEW_ICONS map, passed straight through so each screen topic shows the exact
 * same icon as that screen's nav entry (one source of truth, can't drift). `hiddenScreens` is App.tsx's
 * hiddenNavIds — a topic for a hidden nav item is dropped from the index/cards/results, except the current
 * screen's own pinned topic (if you're on it, its help shows regardless) and the always-present
 * 'training-course-visibility' general topic that explains those very toggles.
 */
export function HelpPanel({
  open,
  onClose,
  screen,
  screenLabel,
  screenIcons,
  hiddenScreens,
}: {
  open: boolean;
  onClose: () => void;
  screen: string;
  screenLabel: string;
  screenIcons: Record<string, LucideIcon>;
  hiddenScreens: ReadonlySet<string>;
}) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentTopic = useMemo(() => HELP_TOPICS.find((t) => t.screen === screen), [screen]);
  const rawResults = useMemo(() => (query.trim() ? searchHelp(query) : null), [query]);
  const results = useMemo(() => rawResults?.filter((t) => !t.screen || !hiddenScreens.has(t.screen)) ?? null, [rawResults, hiddenScreens]);

  // Re-pin+re-expand the current screen's topic, and clear any leftover search, each time the panel is freshly
  // opened OR the active screen changes while it's already open. The panel unmounts when closed (see
  // `if (!open) return null`), so this also resets scroll to the top on every open.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setExpanded(currentTopic ? new Set([currentTopic.id]) : new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately screen/open-triggered, not currentTopic-identity-triggered
  }, [open, screen]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      const opening = !next.has(id);
      if (opening) next.add(id);
      else next.delete(id);
      if (opening) scrollCardIntoView(id);
      return next;
    });
  }

  // Expand (never collapse) a topic and scroll it into view — used by the Contents index, where clicking an
  // entry should always reveal it, not toggle it shut if it happened to be open already.
  function jumpTo(id: string) {
    setExpanded((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
    scrollCardIntoView(id);
  }

  function scrollCardIntoView(id: string) {
    // rAF so the card's (now-taller) expanded body has rendered before we scroll it into view.
    requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function refFor(id: string) {
    return (el: HTMLDivElement | null) => {
      if (el) cardRefs.current.set(id, el);
      else cardRefs.current.delete(id);
    };
  }

  const otherTopics = HELP_TOPICS.filter((t) => t.id !== currentTopic?.id && (!t.screen || !hiddenScreens.has(t.screen)));
  const otherScreenTopics = otherTopics.filter((t) => t.screen);
  const generalTopics = otherTopics.filter((t) => !t.screen);
  // The index lists the current screen first among "Screens" so "you are here" is at the top of that group.
  const indexScreenTopics = currentTopic ? [currentTopic, ...otherScreenTopics] : otherScreenTopics;

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Help">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-xl flex-col border-l shadow-2xl"
        style={{ background: 'var(--vpk-bg)', borderColor: 'var(--vpk-border)' }}
      >
        {/* Banner — same gradient + badge treatment as AboutModal's. */}
        <div className="relative flex items-center gap-3 px-5 py-4" style={{ background: 'linear-gradient(135deg, var(--vpk-accent), var(--vpk-rail-bg))' }}>
          <VpkIcon size={36} className="rounded shrink-0" />
          <div className="min-w-0">
            <div className="font-medium" style={{ color: '#fff' }}>
              Help
            </div>
            <div className="truncate text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
              {screenLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close help"
            className="ml-auto flex shrink-0 cursor-pointer items-center rounded border p-1"
            style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff' }}
          >
            <X size={14} />
          </button>
        </div>

        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}>
          <div className="flex items-center gap-2 rounded border px-2 py-1.5" style={{ borderColor: 'var(--vpk-field-border)', background: 'var(--vpk-bg)' }}>
            <Search size={13} style={{ color: 'var(--vpk-fg-muted)' }} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search help…"
              className="w-full bg-transparent text-xs outline-none"
              style={{ color: 'var(--vpk-fg)' }}
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" className="cursor-pointer" style={{ color: 'var(--vpk-fg-muted)' }}>
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
          {results ? (
            results.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
                No help topics match "{query}".
              </p>
            ) : (
              <div className="space-y-2">
                {results.map((t) => (
                  <TopicCard key={t.id} topic={t} icon={t.screen ? screenIcons[t.screen] : undefined} expanded={expanded.has(t.id)} onToggle={() => toggle(t.id)} cardRef={refFor(t.id)} />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {/* Table of Contents index */}
              <div className="rounded-lg border" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}>
                <div className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: 'var(--vpk-border)', color: 'var(--vpk-fg-muted)' }}>
                  Contents
                </div>
                <div className="px-3 py-2">
                  <IndexGroup
                    label="Screens"
                    topics={indexScreenTopics}
                    icons={screenIcons}
                    currentId={currentTopic?.id}
                    onJump={jumpTo}
                  />
                  <IndexGroup label="General & reference" topics={generalTopics} onJump={jumpTo} />
                </div>
              </div>

              {currentTopic && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vpk-fg-muted)' }}>
                    This screen — {screenLabel}
                  </div>
                  <TopicCard topic={currentTopic} icon={screenIcons[screen]} expanded={expanded.has(currentTopic.id)} onToggle={() => toggle(currentTopic.id)} cardRef={refFor(currentTopic.id)} />
                </div>
              )}
              {otherScreenTopics.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vpk-fg-muted)' }}>
                    Other screens
                  </div>
                  <div className="space-y-2">
                    {otherScreenTopics.map((t) => (
                      <TopicCard key={t.id} topic={t} icon={t.screen ? screenIcons[t.screen] : undefined} expanded={expanded.has(t.id)} onToggle={() => toggle(t.id)} cardRef={refFor(t.id)} />
                    ))}
                  </div>
                </div>
              )}
              {generalTopics.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vpk-fg-muted)' }}>
                    General & reference
                  </div>
                  <div className="space-y-2">
                    {generalTopics.map((t) => (
                      <TopicCard key={t.id} topic={t} expanded={expanded.has(t.id)} onToggle={() => toggle(t.id)} cardRef={refFor(t.id)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function IndexGroup({
  label,
  topics,
  icons,
  currentId,
  onJump,
}: {
  label: string;
  topics: HelpTopic[];
  icons?: Record<string, LucideIcon>;
  currentId?: string;
  onJump: (id: string) => void;
}) {
  if (topics.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vpk-fg-muted)' }}>
        {label}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {topics.map((t) => {
          const Icon = t.screen && icons ? icons[t.screen] : undefined;
          const isCurrent = t.id === currentId;
          return (
            <button
              key={t.id}
              onClick={() => onJump(t.id)}
              className="flex cursor-pointer items-center gap-1 py-0.5 text-left text-xs hover:underline"
              style={{ color: isCurrent ? 'var(--vpk-accent)' : 'var(--vpk-fg)' }}
            >
              {Icon && <Icon size={12} className="shrink-0" style={{ color: 'var(--vpk-fg-muted)' }} />}
              {t.title}
              {isCurrent && <span style={{ color: 'var(--vpk-fg-muted)' }}>· this view</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Figure({ image }: { image: HelpImage }) {
  return (
    <figure className="m-0">
      {/* White figure frame so a fixed-palette server SVG / scene capture reads as an illustration in any theme. */}
      <div className="overflow-hidden rounded border" style={{ borderColor: 'var(--vpk-border)', background: '#ffffff' }}>
        <img src={image.src} alt={image.alt} loading="lazy" className="block h-auto w-full" />
      </div>
      {image.caption && (
        <figcaption className="mt-1 text-[11px] italic" style={{ color: 'var(--vpk-fg-muted)' }}>
          {image.caption}
        </figcaption>
      )}
    </figure>
  );
}

function FieldList({ fields }: { fields: { label: string; description: string }[] }) {
  return (
    <dl className="space-y-1.5">
      {fields.map((f) => (
        <div key={f.label}>
          <dt className="inline text-xs font-medium" style={{ color: 'var(--vpk-fg)' }}>
            {f.label}
          </dt>
          <dd className="inline text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
            {' '}
            — {f.description}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TopicCard({
  topic,
  icon: Icon,
  expanded,
  onToggle,
  cardRef,
}: {
  topic: HelpTopic;
  icon?: LucideIcon;
  expanded: boolean;
  onToggle: () => void;
  cardRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div ref={cardRef} className="scroll-mt-2 rounded-lg border shadow-sm" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}>
      <button onClick={onToggle} className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left">
        {expanded ? <ChevronDown size={13} className="mt-0.5 shrink-0" /> : <ChevronRight size={13} className="mt-0.5 shrink-0" />}
        {Icon && <Icon size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--vpk-fg-muted)' }} />}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium" style={{ color: 'var(--vpk-fg)' }}>
            {topic.title}
          </div>
          {!expanded && (
            <div className="mt-0.5 line-clamp-1 text-[11px]" style={{ color: 'var(--vpk-fg-muted)' }}>
              {topic.summary}
            </div>
          )}
        </div>
      </button>
      {expanded && (
        <div className="space-y-3 border-t px-3 py-2.5" style={{ borderColor: 'var(--vpk-border)' }}>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--vpk-fg-muted)' }}>
            {topic.summary}
          </p>

          {topic.images?.map((img) => <Figure key={img.src} image={img} />)}

          {topic.sections?.map((s) => (
            <div key={s.heading} className="space-y-1.5">
              <div className="text-xs font-semibold" style={{ color: 'var(--vpk-fg)' }}>
                {s.heading}
              </div>
              {s.body && (
                <p className="text-xs leading-relaxed" style={{ color: 'var(--vpk-fg-muted)' }}>
                  {s.body}
                </p>
              )}
              {s.images?.map((img) => <Figure key={img.src} image={img} />)}
              {s.fields && s.fields.length > 0 && <FieldList fields={s.fields} />}
            </div>
          ))}

          {topic.fields && topic.fields.length > 0 && <FieldList fields={topic.fields} />}

          {topic.crossLinks && topic.crossLinks.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--vpk-fg-muted)' }}>
                Links to / from other screens
              </div>
              {topic.crossLinks.map((c, i) => (
                <div key={`${c.from}-${i}`} className="flex items-start gap-1.5">
                  <ArrowRight size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--vpk-accent)' }} />
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--vpk-fg)' }}>
                      {c.from}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
                      {' '}
                      — {c.description}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {topic.commands && topic.commands.length > 0 && (
            <div className="space-y-3">
              {topic.commands.map((c, i) => (
                <CommandBlock key={i} description={c.description} command={c.command} />
              ))}
            </div>
          )}

          {topic.links && topic.links.length > 0 && (
            <ul className="space-y-1">
              {topic.links.map((l) => (
                <li key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--vpk-accent)' }}>
                    <ExternalLink size={11} />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
