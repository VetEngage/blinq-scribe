import { clearFragment, fragmentRoute, linkAccount, takeFragment } from "./start";

const at = (hash: string) => window.history.replaceState(null, "", `/somewhere?x=1${hash}`);

afterEach(() => (["invite", "reset", "oauth", "oauth_error", "oauth_link"] as const).forEach(clearFragment));

describe("links that carry a secret in the #fragment", () => {
  it.each([
    ["#invite=abc", "/invite", "invite"],
    ["#reset=abc", "/reset-password", "reset"],
    ["#oauth=abc", "/sign-in", "oauth"],
    ["#oauth_error=Sign%20in%20with%20your%20password%20first", "/sign-in", "oauth_error"],
  ] as const)("%s goes to %s and leaves the address bar", (hash, route, key) => {
    at(hash);
    expect(fragmentRoute()).toBe(route);
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?x=1");
    expect(takeFragment(key)).toBe(key === "oauth_error" ? "Sign in with your password first" : "abc");
  });

  it("#oauth_link is no route: the signed-in console finishes it, once", async () => {
    at("#oauth_link=code-1");
    expect(fragmentRoute()).toBe("");
    expect(window.location.hash).toBe("");
    const finish = vi.fn().mockResolvedValue({});
    expect(await linkAccount(finish, "Connected")).toBe("Connected");
    expect(finish).toHaveBeenCalledWith("code-1");
    expect(await linkAccount(finish, "Connected")).toBe("");
    expect(finish).toHaveBeenCalledTimes(1);
  });

  it("a link that can't be finished says why", async () => {
    at("#oauth_link=code-2");
    expect(
      await linkAccount(() => Promise.reject(new Error("Start connecting again from your account.")), "Connected"),
    ).toBe("Start connecting again from your account.");
  });

  it("never reads a token from the query string", async () => {
    window.history.replaceState(null, "", "/?token=stolen");
    vi.resetModules();
    const { useSession } = await import("../api/session");
    expect(useSession.getState().token).not.toBe("stolen");
  });
});
