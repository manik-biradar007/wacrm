import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildWordPayload,
  fetchPurchaseBiodata,
  readPaymentId,
  type PurchaseBiodata,
} from "./backend";
import { DEFAULT_TEMPLATE_KEY, templates } from "./templates";
import type { BiodataInfo } from "./render";

const info: BiodataInfo = {
  biodataTitle: "Test",
  godName: "॥ श्री ॥",
  selectedGodIcon: "data:image/png;base64,AAAA",
  fields: {},
  formData: {},
};

describe("readPaymentId", () => {
  it("accepts payment-id style tokens", () => {
    const req = new Request("http://x/api/orders/biodata?paymentId=pay_ABC123");
    expect(readPaymentId(req)).toBe("pay_ABC123");
  });

  it("rejects missing, too-short, and unsafe values", () => {
    expect(readPaymentId(new Request("http://x/api"))).toBeNull();
    expect(readPaymentId(new Request("http://x/api?paymentId=ab"))).toBeNull();
    expect(readPaymentId(new Request("http://x/api?paymentId=pay%20x%26y"))).toBeNull();
    expect(readPaymentId(new Request("http://x/api?paymentId=../../etc"))).toBeNull();
  });
});

describe("buildWordPayload", () => {
  const icon = "data:image/png;base64,iVBORw0KGgo=";

  it("keeps the stored biodata, resolves the template id and uses the supplied icon", () => {
    const purchase: PurchaseBiodata = { template: "fancy_04", type: "word", biodataInfo: info };
    const payload = buildWordPayload(purchase, icon);
    expect(payload?.template).toBe("fancy_04");
    expect(payload?.selectedGodIcon).toBe(icon);
    expect(payload?.biodataTitle).toBe("Test");
  });

  it("falls back to the default template when the stored id is unknown", () => {
    const payload = buildWordPayload(
      { template: "no-such-template", type: null, biodataInfo: info },
      icon,
    );
    expect(payload?.template).toBe(templates[DEFAULT_TEMPLATE_KEY].id);
  });

  it("rejects an icon that is not an inline image data URL", () => {
    const purchase: PurchaseBiodata = { template: "fancy_04", type: null, biodataInfo: info };
    expect(buildWordPayload(purchase, "/images/gods/god-img-3.png")).toBeNull();
    expect(buildWordPayload(purchase, "data:text/html;base64,PGI+")).toBeNull();
  });
});

describe("fetchPurchaseBiodata", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when the backend reports no record", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ success: false }), { status: 200 })),
    );
    await expect(fetchPurchaseBiodata("pay_missing")).resolves.toBeNull();
  });

  it("resolves root-relative profile photos against the backend origin", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            template: "fancy_04",
            type: "word",
            biodataInfo: { ...info, profilePicture: "/images/profile/a.jpg" },
          }),
          { status: 200 },
        ),
      ),
    );
    const result = await fetchPurchaseBiodata("pay_ok123");
    expect(result?.template).toBe("fancy_04");
    expect(result?.biodataInfo.profilePicture).toMatch(/^https:\/\/.+\/images\/profile\/a\.jpg$/);
  });

  it("requests the purchase by its encoded payment id", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ success: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await fetchPurchaseBiodata("pay_ok123");
    const calledUrl = String(fetchMock.mock.calls[0][0]);
    expect(calledUrl).toContain("/biodata?paymentId=pay_ok123");
  });
});
