import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoistProvider } from "./TodoistProvider";

describe("TodoistProvider", () => {
  let provider: TodoistProvider;
  let originalFetch: typeof globalThis.fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new TodoistProvider("fake_token");
    originalFetch = globalThis.fetch;
    mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.clearAllMocks();
  });

  describe("searchTasks", () => {
    it("should sanitize the query and hit the v1 filter API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [{ id: "1", content: "Test Task" }],
          next_cursor: null,
        }),
      });

      const tasks = await provider.searchTasks(
        "Review Quiz: Model Context Protocol (MCP)_quiz",
      );

      expect(tasks).toHaveLength(1);
      expect(tasks[0].content).toBe("Test Task");

      // Verify the URL, search query, and v1 pagination request.
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const calledOpts = mockFetch.mock.calls[0][1] as RequestInit;

      expect(calledUrl).toContain(
        "https://api.todoist.com/api/v1/tasks/filter?query=",
      );
      // "Review Quiz: Model Context Protocol (MCP)_quiz" -> words: Review, Quiz, Model, Context, Protocol, MCP, quiz
      // filter > 2 length: Review, Quiz, Model, Context, Protocol, MCP, quiz
      // slice 0 to 3: Review, Quiz, Model
      const expectedSearchParam = "Review Quiz Model";
      expect(calledUrl).toContain(
        new URLSearchParams({
          query: `search: ${expectedSearchParam}`,
        }).toString(),
      );
      expect(calledUrl).toContain("limit=200");

      const headers = calledOpts.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer fake_token");
    });

    it("should use a default 'Review Quiz' query if sanitization leaves it empty", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [], next_cursor: null }),
      });

      await provider.searchTasks(":) () __ !@# a b");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain(
        new URLSearchParams({ query: "search: Review Quiz" }).toString(),
      );
    });

    it("should throw an error if the fetch response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(provider.searchTasks("Normal Query")).rejects.toThrow(
        "Todoist API error: 400 Bad Request",
      );
    });

    it("should collect paginated result objects correctly", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [
              {
                id: "123",
                content: "Wrapped task",
                due: { date: "2026-08-25" },
              },
            ],
            next_cursor: "second-page",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            results: [{ id: "456", content: "Second page" }],
            next_cursor: null,
          }),
        });

      const tasks = await provider.searchTasks("test");
      expect(tasks).toHaveLength(2);
      expect(tasks[0].id).toBe("123");
      expect(tasks[0].content).toBe("Wrapped task");
      expect(tasks[0].due?.date).toBe("2026-08-25");
    });
  });

  describe("getTasks", () => {
    it("uses the dedicated v1 filter endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ results: [], next_cursor: null }),
      });

      await provider.getTasks({ filter: "search: test" });
      expect(mockFetch.mock.calls[0][0]).toContain(
        "/api/v1/tasks/filter?query=search%3A+test",
      );
    });
  });
});
