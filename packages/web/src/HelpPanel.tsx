import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ExternalLink, ChevronDown, ChevronRight, type LucideIcon } from 'lucide-react';
import { HELP_TOPICS, searchHelp, type HelpTopic } from './helpContent';
import { CommandBlock } from './CommandBlock';
import { VpkIcon } from './VpkIcon';

/**
 * Right-hand slide-out Help panel. With no search active, the CURRENT screen's topic (matched by `screen`
 * prop) is pinned at the top and auto-expanded — "screen specific help" — with every other topic collapsed
 * below it, grouped by whether it's a per-screen topic or a general one. Typing in the search box searches
 * across every topic's title/summary/fields/commands/links (see searchHelp in helpContent.ts) and switches to
 * a flat, selectable results list (title + one-line snippet per row, click to expand) — global, not scoped to
 * the current screen, so you can find help for a DIFFERENT screen than the one you're on.
 *
 * `screenIcons` is App.tsx's own VIEW_ICONS map, passed straight through (not duplicated here) so each
 * screen's help topic shows the exact same icon as that screen's nav rail entry/header title — guaranteed to
 * stay in sync since it's the same object, not a second place that could drift.
 *
 * `hiddenScreens` is App.tsx's hiddenNavIds (Settings > Education's Show Course/Catalog/Teacher toggles) —
 * a screen topic for a nav item the user has hidden doesn't appear in "Other screens" or search results, but
 * the 'training-course-visibility' general topic (which explains those toggles) always does. The CURRENT
 * screen's pinned topic is exempt from this filter — if you're actually on that screen right now, its help
 * shows regardless of the nav toggle.
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

  const currentTopic = useMemo(() => HELP_TOPICS.find((t) => t.screen === screen), [screen]);
  const rawResults = useMemo(() => (query.trim() ? searchHelp(query) : null), [query]);
  const results = useMemo(() => rawResults?.filter((t) => !t.screen || !hiddenScreens.has(t.screen)) ?? null, [rawResults, hiddenScreens]);

  // Re-pin+re-expand the current screen's topic, and clear any leftover search, each time the panel is
  // freshly opened OR the active screen changes while it's already open — navigating with Help open should
  // follow you to the new screen's topic, not silently keep showing the old one. The panel unmounts entirely
  // when closed (see `if (!open) return null` below), so this also naturally resets scroll position to the
  // top on every open — no separate scroll-reset needed for that part.
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
      if (opening) {
        // Scroll the just-expanded card into view once its (now-taller) content has actually rendered —
        // expanding a card lower in a long list can push its own body below the visible scroll area.
        requestAnimationFrame(() => cardRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
      }
      return next;
    });
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

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Help">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-xl flex-col border-l shadow-2xl"
        style={{ background: 'var(--vpk-bg)', borderColor: 'var(--vpk-border)' }}
      >
        {/* Banner — same gradient + badge treatment as AboutModal's, so Help reads as the same brand chrome
            as the rest of the app shell rather than a generic slide-out panel. */}
        <div
          className="relative flex items-center gap-3 px-5 py-4"
          style={{ background: 'linear-gradient(135deg, var(--vpk-accent), var(--vpk-rail-bg))' }}
        >
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

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {results ? (
            results.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--vpk-fg-muted)' }}>
                No help topics match "{query}".
              </p>
            ) : (
              <div className="space-y-2">
                {results.map((t) => (
                  <TopicCard
                    key={t.id}
                    topic={t}
                    icon={t.screen ? screenIcons[t.screen] : undefined}
                    expanded={expanded.has(t.id)}
                    onToggle={() => toggle(t.id)}
                    cardRef={refFor(t.id)}
                  />
                ))}
              </div>
            )
          ) : (
            <div className="space-y-4">
              {currentTopic && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold tracking-wide uppercase" style={{ color: 'var(--vpk-fg-muted)' }}>
                    This screen — {screenLabel}
                  </div>
                  <TopicCard
                    topic={currentTopic}
                    icon={screenIcons[screen]}
                    expanded={expanded.has(currentTopic.id)}
                    onToggle={() => toggle(currentTopic.id)}
                    cardRef={refFor(currentTopic.id)}
                  />
                </div>
              )}
              {otherScreenTopics.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold tracking-wide uppercase" style={{ color: 'var(--vpk-fg-muted)' }}>
                    Other screens
                  </div>
                  <div className="space-y-2">
                    {otherScreenTopics.map((t) => (
                      <TopicCard
                        key={t.id}
                        topic={t}
                        icon={t.screen ? screenIcons[t.screen] : undefined}
                        expanded={expanded.has(t.id)}
                        onToggle={() => toggle(t.id)}
                        cardRef={refFor(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {generalTopics.length > 0 && (
                <div>
                  <div className="mb-1.5 text-[10px] font-semibold tracking-wide uppercase" style={{ color: 'var(--vpk-fg-muted)' }}>
                    General
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
    <div ref={cardRef} className="rounded-lg border shadow-sm" style={{ borderColor: 'var(--vpk-border)', background: 'var(--vpk-surface)' }}>
      <button onClick={onToggle} className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left">
        {expanded ? <ChevronDown size={13} className="mt-0.5 shrink-0" /> : <ChevronRight size={13} className="mt-0.5 shrink-0" />}
        {Icon && <Icon size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--vpk-fg-muted)' }} />}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium" style={{ color: 'var(--vpk-fg)' }}>
            {topic.title}
          </div>
          {/* Collapsed-state snippet — what makes the search results actually a "list of matching items you
              can pick from" rather than just titles you'd have to click blind to evaluate. */}
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
          {topic.fields && topic.fields.length > 0 && (
            <dl className="space-y-1.5">
              {topic.fields.map((f) => (
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
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs"
                    style={{ color: 'var(--vpk-accent)' }}
                  >
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
