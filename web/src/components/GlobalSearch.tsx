import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "@/lib/api";

type SearchResultType = "appointment" | "expense" | "customer" | "artist";

interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  href: string;
}

interface GlobalSearchResponse {
  query: string;
  results: SearchResultItem[];
  groups: {
    appointments: SearchResultItem[];
    expenses: SearchResultItem[];
    customers: SearchResultItem[];
    artists: SearchResultItem[];
  };
}

const TYPE_LABELS: Record<SearchResultType, string> = {
  appointment: "Appointment",
  expense: "Expense",
  customer: "Customer",
  artist: "Artist",
};

function typeBadgeClass(type: SearchResultType): string {
  return `global-search-badge global-search-badge-${type}`;
}

interface GlobalSearchProps {
  placeholder?: string;
}

export function GlobalSearch({
  placeholder = "Search appointments, expenses, customers…",
}: GlobalSearchProps) {
  const listId = useId();
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<GlobalSearchResponse | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    if (debouncedQuery.length < 2) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<GlobalSearchResponse>(
        `/api/search?q=${encodeURIComponent(debouncedQuery)}`,
      );
      setData(res);
      setActiveIndex(-1);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const results = data?.results ?? [];
  const showPanel = open && query.trim().length > 0;

  const goTo = (href: string) => {
    setOpen(false);
    setQuery("");
    setData(null);
    navigate(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (!showPanel || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) goTo(item.href);
    }
  };

  return (
    <div className="global-search" ref={rootRef}>
      <label className="global-search-label" htmlFor={`${listId}-input`}>
        <span className="sr-only">Search studio data</span>
        <input
          id={`${listId}-input`}
          ref={inputRef}
          type="search"
          className="global-search-input"
          placeholder={placeholder}
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </label>

      {showPanel && (
        <div
          id={`${listId}-listbox`}
          className="global-search-panel"
          role="listbox"
          aria-label="Search results"
        >
          {debouncedQuery.length < 2 ? (
            <p className="global-search-hint text-muted">Type at least 2 characters</p>
          ) : loading ? (
            <p className="global-search-hint text-muted">Searching…</p>
          ) : results.length === 0 ? (
            <p className="global-search-hint text-muted">No matches for &quot;{debouncedQuery}&quot;</p>
          ) : (
            <ul className="global-search-results">
              {results.map((item, index) => (
                <li key={`${item.type}-${item.id}`}>
                  <Link
                    to={item.href}
                    className={
                      index === activeIndex
                        ? "global-search-result global-search-result-active"
                        : "global-search-result"
                    }
                    role="option"
                    aria-selected={index === activeIndex}
                    onClick={() => {
                      setOpen(false);
                      setQuery("");
                      setData(null);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <span className={typeBadgeClass(item.type)}>{TYPE_LABELS[item.type]}</span>
                    <span className="global-search-result-main">
                      <span className="global-search-result-title">{item.title}</span>
                      <span className="global-search-result-subtitle">{item.subtitle}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
