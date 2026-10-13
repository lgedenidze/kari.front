import { describe, expect, it } from "vitest";
import { networkOf, shortLink } from "./profile-link";

describe("the network a profile link is on", () => {
  it("names the networks staff know", () => {
    expect(networkOf("https://www.instagram.com/nika.beridze")).toBe("Instagram");
    expect(networkOf("https://www.facebook.com/profile.php?id=100012345678901")).toBe("Facebook");
    expect(networkOf("https://www.tiktok.com/@nika")).toBe("TikTok");
    expect(networkOf("https://x.com/nika")).toBe("X");
    expect(networkOf("https://twitter.com/nika")).toBe("X");
    expect(networkOf("https://www.linkedin.com/in/nika-beridze/")).toBe("LinkedIn");
    expect(networkOf("https://t.me/nika")).toBe("Telegram");
  });

  it("shows the host of any other link, so a tap never goes somewhere unread", () => {
    expect(networkOf("https://www.example.org/people/nika")).toBe("example.org");
  });

  it("is not fooled by a host that only starts like a network", () => {
    expect(networkOf("https://instagram.com.evil.example/nika")).toBe("instagram.com.evil.example");
    expect(networkOf("https://notinstagram.com/nika")).toBe("notinstagram.com");
  });

  it("leaves alone what is not a link at all", () => {
    expect(networkOf("nika")).toBe("nika");
  });
});

describe("a profile link, shortened for a phone", () => {
  it("drops the scheme, the www and a trailing slash", () => {
    expect(shortLink("https://www.instagram.com/nika.beridze")).toBe("instagram.com/nika.beridze");
    expect(shortLink("https://www.facebook.com/share/1AbCdEfGhI/")).toBe("facebook.com/share/1AbCdEfGhI");
    expect(shortLink("http://vk.com/id12345")).toBe("vk.com/id12345");
  });
});
