import { describe, expect, it } from "vitest";

import {
  verifyCandidateWithAi,
  type AiVerifierDecision,
  type CandidateVerificationInput,
  type CandidateVerifierConfig,
} from "../../supabase/functions/_shared/candidate-verifier";
import type { Candidate, GmailCategory } from "../../supabase/functions/_shared/gmail";

const config: CandidateVerifierConfig = {
  enabled: true,
  apiKey: "test-key",
  endpoint: "https://example.com/verifier",
  model: "test-model",
  minConfidence: 0.82,
  timeoutMs: 100,
};

function candidate(category: GmailCategory): Candidate {
  return {
    id: `gmail:test-${category}`,
    source: "gmail",
    sourceMessageId: `test-${category}`,
    title: "Possible Undo item",
    category,
    dueAt: "2026-05-12T17:00:00.000Z",
    merchant: "Example",
  };
}

async function runVerifier(input: CandidateVerificationInput, decision: AiVerifierDecision) {
  return verifyCandidateWithAi(input, config, async () => decision);
}

function inputFor(category: GmailCategory, subject: string, snippet: string): CandidateVerificationInput {
  return {
    candidate: candidate(category),
    email: {
      subject,
      from: "Example <hello@example.com>",
      snippet,
      bodyExcerpt: snippet,
      internalDate: String(new Date("2026-05-10T12:00:00Z").getTime()),
    },
  };
}

describe("AI candidate verifier policy", () => {
  it("approves a real trial deadline", async () => {
    const result = await runVerifier(
      inputFor("trial", "FitTrack trial ends tomorrow", "Your free trial ends tomorrow. Cancel before you are charged."),
      {
        should_surface: true,
        category: "trial",
        merchant: "FitTrack",
        title: "FitTrack trial may convert tomorrow",
        due_date: "2026-05-12T17:00:00.000Z",
        amount: null,
        currency: null,
        confidence: 0.94,
        reason: "Trial conversion deadline.",
        evidence: "trial ends tomorrow",
      },
    );

    expect(result.approved).toBe(true);
    expect(result.candidate?.category).toBe("trial");
    expect(result.candidate?.merchant).toBe("FitTrack");
  });

  it("approves a genuine retail return window", async () => {
    const result = await runVerifier(
      inputFor("return", "Your return window closes soon", "Return by May 18 using your return label."),
      {
        should_surface: true,
        category: "return",
        merchant: "North & Co",
        title: "North & Co return window closes May 18",
        due_date: "2026-05-18T17:00:00.000Z",
        amount: 79,
        currency: "GBP",
        confidence: 0.91,
        reason: "Retail return deadline.",
        evidence: "Return by May 18",
      },
    );

    expect(result.approved).toBe(true);
    expect(result.candidate?.category).toBe("return");
    expect(result.candidate?.amountValue).toBe(79);
  });

  it("rejects an Uber receipt", async () => {
    const result = await runVerifier(
      inputFor("bill", "Your Uber receipt", "Trip receipt. Your payment of GBP 18.60 was paid with Visa."),
      {
        should_surface: false,
        category: "none",
        merchant: "Uber",
        title: null,
        due_date: null,
        amount: null,
        currency: null,
        confidence: 0.98,
        reason: "Receipt, not unpaid bill.",
        evidence: "Trip receipt",
      },
    );

    expect(result.approved).toBe(false);
    expect(result.rejectionCode).toBe("not_actionable");
  });

  it("rejects a Trainline booking confirmation", async () => {
    const result = await runVerifier(
      inputFor("bill", "Trainline booking confirmation", "Your ticket confirmation. Paid GBP 34.50 with Visa."),
      {
        should_surface: false,
        category: "none",
        merchant: "Trainline",
        title: null,
        due_date: null,
        amount: null,
        currency: null,
        confidence: 0.97,
        reason: "Booking confirmation.",
        evidence: "ticket confirmation",
      },
    );

    expect(result.approved).toBe(false);
    expect(result.rejectionCode).toBe("not_actionable");
  });

  it("rejects transfer/refund return wording that is not a retail return window", async () => {
    const result = await runVerifier(
      inputFor("return", "Your Revolut transfer was returned", "The bank transfer was returned to your Revolut account."),
      {
        should_surface: true,
        category: "return",
        merchant: "Revolut",
        title: "Revolut return may need review",
        due_date: "2026-05-16T17:00:00.000Z",
        amount: null,
        currency: null,
        confidence: 0.89,
        reason: "Returned transfer.",
        evidence: "transfer was returned",
      },
    );

    expect(result.approved).toBe(false);
    expect(result.rejectionCode).toBe("weak_return_evidence");
  });

  it("approves a clear unpaid bill", async () => {
    const result = await runVerifier(
      inputFor("bill", "Your BrightNet invoice", "Your BrightNet invoice for GBP 34.50 is due on May 15."),
      {
        should_surface: true,
        category: "bill",
        merchant: "BrightNet",
        title: "BrightNet invoice is due May 15",
        due_date: "2026-05-15T17:00:00.000Z",
        amount: 34.5,
        currency: "GBP",
        confidence: 0.95,
        reason: "Invoice due date.",
        evidence: "invoice for GBP 34.50 is due on May 15",
      },
    );

    expect(result.approved).toBe(true);
    expect(result.candidate?.category).toBe("bill");
    expect(result.candidate?.merchant).toBe("BrightNet");
  });
});
