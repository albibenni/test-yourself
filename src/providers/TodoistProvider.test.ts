import { TodoistApi } from "@doist/todoist-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TodoistProvider } from "./TodoistProvider";

// Mock TodoistApi since it's used internally
vi.mock("@doist/todoist-sdk", () => {
  return {
    TodoistApi: vi.fn().mockImplementation(function () {
      return {
        getTasks: vi.fn(),
      };
    }),
  };
});

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
        json: async () => [{ id: "1", content: "Test Task" }],
      });

      const tasks = await provider.searchTasks(
        "Review Quiz: Model Context Protocol (MCP)_quiz",
      );

      expect(tasks).toHaveLength(1);
      expect(tasks[0].content).toBe("Test Task");

      // Verify the URL and search query
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
        encodeURIComponent(`search: ${expectedSearchParam}`),
      );

      const headers = calledOpts.headers as Record<string, string>;
      expect(headers.Authorization).toBe("Bearer fake_token");
    });

    it("should use a default 'Review Quiz' query if sanitization leaves it empty", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await provider.searchTasks(":) () __ !@# a b");

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain(encodeURIComponent("search: Review Quiz"));
    });

    it("should throw an error if the fetch response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      });

      await expect(provider.searchTasks("Normal Query")).rejects.toThrow(
        "Failed to search tasks: 400 Bad Request",
      );
    });

    it("should parse wrapped result objects correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { id: "123", content: "Wrapped task", due: { date: "2026-08-25" } },
          ],
        }),
      });

      const tasks = await provider.searchTasks("test");
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe("123");
      expect(tasks[0].content).toBe("Wrapped task");
      expect(tasks[0].due?.date).toBe("2026-08-25");
    });
  });

  describe("getTasks", () => {
    it("should pass the filter argument to the API client when provided", async () => {
      const mockGetTasks = vi.fn().mockResolvedValue([]);
      vi.mocked(TodoistApi).mockImplementation(function () {
        return {
          getTasks: mockGetTasks,
        } as unknown as TodoistApi;
      });

      // Remount provider to get the updated mock
      provider = new TodoistProvider("fake_token");

      await provider.getTasks({ filter: "search: test" });
      expect(mockGetTasks).toHaveBeenCalledWith({ filter: "search: test" });
    });
  });
});
