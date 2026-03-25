import { beforeEach, describe, expect, it } from "vitest";
import {
  loadRecentBoards,
  rememberRecentBoard,
  validateBoardUrl,
} from "../lib/board-url";

describe("validateBoardUrl", () => {
  it("trims and normalizes valid board URLs", () => {
    const result = validateBoardUrl("  https://engage.folloze.com/my-board/  ");
    expect(result.isValid).toBe(true);
    expect(result.normalizedUrl).toBe("https://engage.folloze.com/my-board");
    expect(result.warning).toBeNull();
  });

  it("rejects unsupported protocols", () => {
    const result = validateBoardUrl("javascript:alert(1)");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("http or https");
  });

  it("rejects board URLs with query params", () => {
    const result = validateBoardUrl("https://engage.folloze.com/board?foo=bar");
    expect(result.isValid).toBe(false);
    expect(result.error).toContain("clean board URL");
  });

  it("warns on non-Folloze hostnames without blocking valid URLs", () => {
    const result = validateBoardUrl("https://example.com/board");
    expect(result.isValid).toBe(true);
    expect(result.warning).toContain("does not look like a Folloze destination");
  });
});

describe("recent boards", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        clear: () => {
          store.clear();
        },
      },
    });
  });

  it("stores recent boards in most-recent-first order", () => {
    rememberRecentBoard("https://engage.folloze.com/board-a");
    const boards = rememberRecentBoard("https://engage.folloze.com/board-b");
    expect(boards).toEqual([
      "https://engage.folloze.com/board-b",
      "https://engage.folloze.com/board-a",
    ]);
  });

  it("deduplicates existing boards", () => {
    rememberRecentBoard("https://engage.folloze.com/board-a");
    rememberRecentBoard("https://engage.folloze.com/board-b");
    const boards = rememberRecentBoard("https://engage.folloze.com/board-a");
    expect(boards[0]).toBe("https://engage.folloze.com/board-a");
    expect(loadRecentBoards()).toHaveLength(2);
  });
});
