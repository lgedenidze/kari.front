import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { ask, askPatiently, forgetAll, KEEP_MS, peek, put, RETRY_AFTER_MS, watch } from "./live-store";

beforeEach(() => {
  vi.useFakeTimers();
  forgetAll();
});

afterEach(() => {
  vi.useRealTimers();
});

/** A request whose answer the test hands over when it chooses. */
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe("the answers a screen keeps", () => {
  it("remembers the last answer and tells whoever is watching", () => {
    const told = vi.fn();
    const stop = watch("/pass/tonight", told);

    put("/pass/tonight", { ticket: 1 });

    expect(peek("/pass/tonight")).toEqual({ ticket: 1 });
    expect(told).toHaveBeenCalledTimes(1);

    stop();
    put("/pass/tonight", { ticket: 2 });
    expect(told).toHaveBeenCalledTimes(1);
  });

  it("keeps one screen's answer apart from another's", () => {
    put("/invites", "invites");
    expect(peek("/pass/tonight")).toBeUndefined();
  });

  it("shares one request between two callers asking at once", async () => {
    const request = pending<string>();
    const fetcher = vi.fn(() => request.promise);

    const first = ask("/invites", fetcher);
    const second = ask("/invites", fetcher);
    request.resolve("answer");

    expect(await first).toBe("answer");
    expect(await second).toBe("answer");
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(peek("/invites")).toBe("answer");
  });

  it("asks afresh once the earlier request is back", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce("one").mockResolvedValueOnce("two");
    await ask("/invites", fetcher);
    await ask("/invites", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(peek("/invites")).toBe("two");
  });

  it("drops an answer that was on its way when something newer was stored", async () => {
    // The poll left before the member pressed "get tonight's pass"; it comes back after.
    const poll = pending<string>();
    const asked = ask("/pass/tonight", () => poll.promise);

    put("/pass/tonight", "the pass just printed");
    poll.resolve("no pass yet");
    await asked;

    expect(peek("/pass/tonight")).toBe("the pass just printed");
  });

  it("keeps the last answer when asking again fails", async () => {
    put("/pass/tonight", "a pass");
    await expect(ask("/pass/tonight", () => Promise.reject(new Error("no signal")))).rejects.toThrow("no signal");
    expect(peek("/pass/tonight")).toBe("a pass");
  });

  it("forgets an answer nobody has looked at for a while", () => {
    put("/admin/overview", "figures");

    vi.advanceTimersByTime(KEEP_MS - 1);
    expect(peek("/admin/overview")).toBe("figures");

    vi.advanceTimersByTime(2);
    expect(peek("/admin/overview")).toBeUndefined();
  });

  it("never forgets an answer that is on screen", () => {
    // A pass held up in a basement with no signal must stay exactly where it is.
    const stop = watch("/pass/tonight", () => {});
    put("/pass/tonight", "a pass");

    vi.advanceTimersByTime(KEEP_MS * 10);
    expect(peek("/pass/tonight")).toBe("a pass");

    // Once the screen is left, the clock starts.
    stop();
    vi.advanceTimersByTime(KEEP_MS + 1);
    expect(peek("/pass/tonight")).toBeUndefined();
  });

  it("starts the clock again when the screen is opened and left once more", () => {
    put("/invites", "invites");
    vi.advanceTimersByTime(KEEP_MS - 10);

    const stop = watch("/invites", () => {});
    vi.advanceTimersByTime(KEEP_MS);
    stop();

    vi.advanceTimersByTime(KEEP_MS - 10);
    expect(peek("/invites")).toBe("invites");
  });

  it("forgets everything on signing in or out, and says so", async () => {
    const told = vi.fn();
    watch("/pass/tonight", told);
    put("/pass/tonight", "someone's pass");
    put("/invites", "someone's invites");
    told.mockClear();

    // A request that belonged to the account that just left must not land afterwards.
    const late = pending<string>();
    const asked = ask("/pass/tonight", () => late.promise);
    forgetAll();
    late.resolve("someone's pass, again");
    await asked;

    expect(peek("/pass/tonight")).toBeUndefined();
    expect(peek("/invites")).toBeUndefined();
    expect(told).toHaveBeenCalled();
  });

  it("drops a first answer that lands after signing out", async () => {
    // Nothing was stored yet: the screen was still on its placeholder when the account left.
    const late = pending<string>();
    const asked = ask("/door/tonight", () => late.promise);
    forgetAll();
    late.resolve("the last account's door");
    await asked;

    expect(peek("/door/tonight")).toBeUndefined();
  });
});

describe("asking with patience", () => {
  const down = () => new ApiError(500, "server_error");

  it("tries again by itself when the server has a bad moment, and tells nobody", async () => {
    const fetcher = vi.fn().mockRejectedValueOnce(down()).mockRejectedValueOnce(new ApiError(0, "network")).mockResolvedValueOnce("invites");

    const asked = askPatiently("/invites", fetcher);
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS[0] + RETRY_AFTER_MS[1]);

    expect(await asked).toBe("invites");
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(peek("/invites")).toBe("invites");
  });

  it("gives up after its retries, with the failure it met last", async () => {
    const fetcher = vi.fn().mockRejectedValue(down());

    const asked = askPatiently("/invites", fetcher);
    const outcome = expect(asked).rejects.toMatchObject({ code: "server_error" });
    await vi.advanceTimersByTimeAsync(RETRY_AFTER_MS[0] + RETRY_AFTER_MS[1]);
    await outcome;

    expect(fetcher).toHaveBeenCalledTimes(RETRY_AFTER_MS.length + 1);
  });

  it("does not ask again when the answer was a refusal", async () => {
    // Not allowed, not found, too many requests: the same question gets the same answer.
    for (const status of [401, 403, 404, 429]) {
      const fetcher = vi.fn().mockRejectedValue(new ApiError(status, "refused"));
      await expect(askPatiently(`/refused/${status}`, fetcher)).rejects.toMatchObject({ status });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
});
