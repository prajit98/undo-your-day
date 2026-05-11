import { describe, expect, it } from "vitest";

import {
  messageToCandidate,
  type GmailMessage,
} from "../../supabase/functions/_shared/gmail";

function gmailMessage(input: {
  subject: string;
  snippet: string;
  from?: string;
  internalDate?: string;
}): GmailMessage {
  return {
    id: input.subject.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    internalDate: input.internalDate ?? String(new Date("2026-05-01T12:00:00Z").getTime()),
    snippet: input.snippet,
    payload: {
      headers: [
        { name: "Subject", value: input.subject },
        { name: "From", value: input.from ?? "Billing <billing@example.com>" },
      ],
    },
  };
}

describe("Gmail bill detection", () => {
  it("surfaces a clear invoice with a due date", () => {
    const candidate = messageToCandidate(
      gmailMessage({
        subject: "Your BrightNet invoice",
        snippet: "Your BrightNet invoice for £34.50 is due on May 5.",
        from: "BrightNet Billing <billing@brightnet.co.uk>",
      }),
      "bill",
      ["bill"],
    );

    expect(candidate).not.toBeNull();
    expect(candidate?.category).toBe("bill");
    expect(candidate?.title).toContain("BrightNet");
  });

  it("suppresses ride receipts even when they contain an amount", () => {
    const candidate = messageToCandidate(
      gmailMessage({
        subject: "Your Uber receipt",
        snippet: "Uber receipt total £18.60 paid with Visa. Thanks for riding.",
        from: "Uber Receipts <receipts@uber.com>",
      }),
      "bill",
      ["bill"],
    );

    expect(candidate).toBeNull();
  });

  it("suppresses ticket and booking confirmations", () => {
    const candidate = messageToCandidate(
      gmailMessage({
        subject: "Trainline booking confirmation",
        snippet: "Your ticket confirmation for London to Brighton. Paid £34.50 with Visa.",
        from: "Trainline <tickets@info.thetrainline.com>",
      }),
      "bill",
      ["bill"],
    );

    expect(candidate).toBeNull();
  });

  it("suppresses generic payment confirmations without unpaid bill language", () => {
    const candidate = messageToCandidate(
      gmailMessage({
        subject: "Payment confirmation",
        snippet: "Your payment of £34.50 was received. Order confirmation attached.",
      }),
      "bill",
      ["bill"],
    );

    expect(candidate).toBeNull();
  });
});
