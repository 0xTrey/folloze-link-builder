const RECENT_BOARDS_STORAGE_KEY = "folloze-recent-boards";
const MAX_RECENT_BOARDS = 5;

export interface BoardUrlValidation {
  isEmpty: boolean;
  isValid: boolean;
  normalizedUrl: string;
  error: string | null;
  warning: string | null;
  hostname: string | null;
}

export function validateBoardUrl(rawValue: string): BoardUrlValidation {
  const trimmed = rawValue.trim();

  if (!trimmed) {
    return {
      isEmpty: true,
      isValid: false,
      normalizedUrl: "",
      error: null,
      warning: null,
      hostname: null,
    };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return {
      isEmpty: false,
      isValid: false,
      normalizedUrl: "",
      error: "Enter a valid board URL.",
      warning: null,
      hostname: null,
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      isEmpty: false,
      isValid: false,
      normalizedUrl: "",
      error: "Board URLs must use http or https.",
      warning: null,
      hostname: parsed.hostname || null,
    };
  }

  if (parsed.search || parsed.hash) {
    return {
      isEmpty: false,
      isValid: false,
      normalizedUrl: "",
      error: "Use the clean board URL without query parameters or fragments.",
      warning: null,
      hostname: parsed.hostname || null,
    };
  }

  const normalizedUrl = trimmed.replace(/\/+$/, "");
  const warning = /(^|\.)(folloze\.com)$/i.test(parsed.hostname)
    ? null
    : "This hostname does not look like a Folloze destination. Double-check the board URL before generating links.";

  return {
    isEmpty: false,
    isValid: true,
    normalizedUrl,
    error: null,
    warning,
    hostname: parsed.hostname || null,
  };
}

export function loadRecentBoards(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = window.localStorage.getItem(RECENT_BOARDS_STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

export function rememberRecentBoard(boardUrl: string): string[] {
  const normalized = boardUrl.trim();
  if (!normalized) return loadRecentBoards();

  const nextBoards = [normalized, ...loadRecentBoards().filter((value) => value !== normalized)].slice(
    0,
    MAX_RECENT_BOARDS
  );

  if (typeof window !== "undefined") {
    window.localStorage.setItem(RECENT_BOARDS_STORAGE_KEY, JSON.stringify(nextBoards));
  }

  return nextBoards;
}
