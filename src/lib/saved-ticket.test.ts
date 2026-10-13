import { describe, expect, it } from "vitest";
import { savedTicketCode } from "./saved-ticket";

describe("the QR on a saved ticket", () => {
  it("gives the short code for each kind of ticket", () => {
    expect(savedTicketCode("https://nisli.ge/pass?c=1AD0H6")).toBe("1AD0H6");
    expect(savedTicketCode("https://nisli.ge/i/Qm3xT9aa?c=7KP2QX")).toBe("7KP2QX");
    expect(savedTicketCode("https://nisli.ge/t/abcDEF123_-?c=ZZ99AA")).toBe("ZZ99AA");
  });

  it("does not care which address the site is on, or how the code is cased", () => {
    expect(savedTicketCode("http://localhost:3000/pass?c=1ad0h6")).toBe("1AD0H6");
    expect(savedTicketCode("  https://kari-kappa.vercel.app/pass/?c=1AD0H6  ")).toBe("1AD0H6");
  });

  it("is not fooled by a live pass code, another page, or anything else", () => {
    expect(savedTicketCode("K1.0123456789ABCDEF.01234567")).toBeNull();
    expect(savedTicketCode("https://nisli.ge/pass")).toBeNull();
    expect(savedTicketCode("https://nisli.ge/admin?c=1AD0H6")).toBeNull();
    expect(savedTicketCode("https://nisli.ge/pass?c=<script>")).toBeNull();
    expect(savedTicketCode("https://nisli.ge/i/a/b?c=1AD0H6")).toBeNull();
    expect(savedTicketCode("javascript:alert(1)//pass?c=1AD0H6")).toBeNull();
    expect(savedTicketCode("WIFI:S:bar;T:WPA;P:secret;;")).toBeNull();
    expect(savedTicketCode("")).toBeNull();
  });
});
