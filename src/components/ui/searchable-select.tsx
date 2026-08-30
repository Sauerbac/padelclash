"use client";

import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  ariaLabel?: string;
  suffix?: React.ReactNode;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  label,
  placeholder,
  searchPlaceholder = "Search…",
  emptyText = "No results found.",
}: {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  label: string;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) =>
      option.label.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [options, query]);

  const updateScrollShadows = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    setCanScrollUp(list.scrollTop > 0);
    setCanScrollDown(
      list.scrollTop + list.clientHeight < list.scrollHeight,
    );
  }, []);

  const revealPicker = useCallback((behavior: ScrollBehavior = "auto") => {
    const scrollRoot = document.getElementById("scroll-root");
    const trigger = triggerRef.current;
    if (!scrollRoot || !trigger) return;

    const rootTop = scrollRoot.getBoundingClientRect().top;
    const triggerTop = trigger.getBoundingClientRect().top;
    const nextTop = Math.max(
      0,
      scrollRoot.scrollTop + triggerTop - rootTop - 16,
    );
    if (Math.abs(nextTop - scrollRoot.scrollTop) < 1) return;
    scrollRoot.scrollTo({ top: nextTop, behavior });
  }, []);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    let frame = 0;
    const revealAfterViewportChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => revealPicker());
    };
    viewport.addEventListener("resize", revealAfterViewportChange);
    viewport.addEventListener("scroll", revealAfterViewportChange);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", revealAfterViewportChange);
      viewport.removeEventListener("scroll", revealAfterViewportChange);
    };
  }, [open, revealPicker]);

  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    if (!list) return;
    const frame = requestAnimationFrame(updateScrollShadows);
    const resizeObserver = new ResizeObserver(updateScrollShadows);
    resizeObserver.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
    };
  }, [filteredOptions, open, updateScrollShadows]);

  const choose = (nextValue: string) => {
    onValueChange(nextValue);
    setOpen(false);
  };

  const focusOption = (current: HTMLElement, direction: 1 | -1) => {
    const options = Array.from(
      current
        .closest('[role="listbox"]')
        ?.querySelectorAll<HTMLElement>('[role="option"]') ?? [],
    );
    const nextIndex = options.indexOf(current) + direction;
    options[nextIndex]?.focus();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          variant="secondary"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listboxId}
          className="h-auto w-full min-w-0 justify-between gap-2 overflow-hidden bg-input px-3.5 py-3 text-lg font-semibold tracking-[1px] text-foreground hover:bg-input"
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-left",
              !selected && "text-muted-foreground",
            )}
          >
            {selected?.label ?? placeholder}
          </span>
          <ChevronDownIcon
            aria-hidden
            className="size-4 shrink-0 text-muted-foreground opacity-50"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="flex max-h-[min(18rem,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] flex-col overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => revealPicker("smooth"));
        }}
      >
        <div className="relative shrink-0 border-b">
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            ref={searchRef}
            type="search"
            value={query}
            onFocus={() => revealPicker()}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                document
                  .getElementById(listboxId)
                  ?.querySelector<HTMLElement>('[role="option"]')
                  ?.focus();
              }
              if (event.key === "Enter" && filteredOptions[0]) {
                event.preventDefault();
                choose(filteredOptions[0].value);
              }
            }}
            aria-label="Search players"
            aria-controls={listboxId}
            autoComplete="off"
            placeholder={searchPlaceholder}
            className="bg-popover pl-10"
          />
        </div>
        <div className="relative min-h-0 overflow-hidden">
          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={label}
            onScroll={updateScrollShadows}
            className="max-h-[min(15rem,calc(var(--radix-popover-content-available-height)_-_3rem))] overflow-y-auto overscroll-contain p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {emptyText}
              </p>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-label={option.ariaLabel}
                  aria-selected={option.value === value}
                  onClick={() => choose(option.value)}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      focusOption(event.currentTarget, 1);
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      const previous =
                        event.currentTarget.previousElementSibling;
                      if (previous) focusOption(event.currentTarget, -1);
                      else searchRef.current?.focus();
                    }
                  }}
                  className="relative flex w-full min-w-0 items-center gap-2 py-2.5 pr-8 pl-3 text-left text-base font-semibold tracking-[1px] uppercase outline-hidden select-none hover:bg-secondary focus:bg-secondary focus:text-foreground"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  {option.suffix}
                  {option.value === value && (
                    <CheckIcon
                      aria-hidden
                      className="absolute right-2 size-4 shrink-0"
                    />
                  )}
                </button>
              ))
            )}
          </div>
          <div
            data-scroll-shadow="top"
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-black/75 to-transparent transition-opacity",
              canScrollUp ? "opacity-100" : "opacity-0",
            )}
          />
          <div
            data-scroll-shadow="bottom"
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t from-black/75 to-transparent transition-opacity",
              canScrollDown ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
