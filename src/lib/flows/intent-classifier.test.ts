import { describe, it, expect, vi, beforeEach } from "vitest";

const loadAiConfigMock = vi.fn();
const generateReplyMock = vi.fn();

vi.mock("@/lib/ai/config", () => ({
  loadAiConfig: (...args: unknown[]) => loadAiConfigMock(...args),
}));
vi.mock("@/lib/ai/generate", () => ({
  generateReply: (...args: unknown[]) => generateReplyMock(...args),
}));

import { classifyIntent, type IntentCandidate } from "./intent-classifier";

const FAKE_CONFIG = {
  provider: "openai" as const,
  model: "gpt-test",
  apiKey: "sk-test",
  systemPrompt: null,
  isActive: true,
  autoReplyEnabled: false,
  autoReplyMaxPerConversation: 0,
  handoffAgentId: null,
  embeddingsApiKey: null,
};

const CANDIDATES: IntentCandidate[] = [
  { reply_id: "btn_edit", title: "Edit biodata", next_node_key: "node_edit" },
  { reply_id: "btn_download", title: "Download issue", next_node_key: "node_dl" },
];

const db = {} as never;

describe("classifyIntent", () => {
  beforeEach(() => {
    loadAiConfigMock.mockReset();
    generateReplyMock.mockReset();
  });

  it("returns unavailable when there are no candidates", async () => {
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "hello",
      candidates: [],
    });
    expect(result).toEqual({ status: "unavailable" });
    expect(loadAiConfigMock).not.toHaveBeenCalled();
  });

  it("returns unavailable when the account has no active AI config", async () => {
    loadAiConfigMock.mockResolvedValue(null);
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "mala biodata edit karaycha ahe",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({ status: "unavailable" });
    expect(generateReplyMock).not.toHaveBeenCalled();
  });

  it("matches an exact reply_id returned by the model", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockResolvedValue({
      text: "btn_edit",
      handoff: false,
      usage: null,
    });
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "mala biodata edit karaycha ahe",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({
      status: "matched",
      next_node_key: "node_edit",
      reply_id: "btn_edit",
    });
  });

  it("tolerates surrounding quotes/punctuation and extra whitespace", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockResolvedValue({
      text: '  "btn_download".  \nextra ignored line',
      handoff: false,
      usage: null,
    });
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "download nahi zala",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({
      status: "matched",
      next_node_key: "node_dl",
      reply_id: "btn_download",
    });
  });

  it("returns none on an explicit NONE response", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockResolvedValue({
      text: "NONE",
      handoff: false,
      usage: null,
    });
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "what's the weather",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({ status: "none" });
  });

  it("treats a hallucinated id as none (fail closed)", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockResolvedValue({
      text: "btn_does_not_exist",
      handoff: false,
      usage: null,
    });
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "something",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({ status: "none" });
  });

  it("treats prose-wrapped extra content as none", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockResolvedValue({
      text: "I think the answer is btn_edit but not sure",
      handoff: false,
      usage: null,
    });
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "something",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({ status: "none" });
  });

  it("returns unavailable when the provider call throws", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockRejectedValue(new Error("provider down"));
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "something",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({ status: "unavailable" });
  });

  it("returns unavailable when the provider call times out", async () => {
    loadAiConfigMock.mockResolvedValue(FAKE_CONFIG);
    generateReplyMock.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    vi.stubEnv("AI_INTENT_CLASSIFY_TIMEOUT_MS", "10");
    const result = await classifyIntent({
      db,
      accountId: "acc1",
      text: "something",
      candidates: CANDIDATES,
    });
    expect(result).toEqual({ status: "unavailable" });
    vi.unstubAllEnvs();
  });
});
