import { mapParsedRetailAICallToActivity } from "@/lib/retail-ai/mapper";
import { parseRetailAICall, RetailAIPayload } from "@/lib/retail-ai/parser";

describe("Retail AI Parser", () => {
  const samplePayload: RetailAIPayload = {
    event: "call_analyzed",
    call: {
      call_id: "test-call-id",
      transcript: "Agent: Hello, User: My name is John Doe and I want to buy insurance.",
      transcript_object: [
        { role: "agent", content: "Hello" },
        { role: "user", content: "My name is John Doe and I want to buy insurance." }
      ],
      recording_url: "https://recording.url",
      public_log_url: "https://logs.url",
      start_timestamp: 1716634800000, // 2024-05-25 11:00:00
      end_timestamp: 1716634920000,   // 2024-05-25 11:02:00
      duration_ms: 120000,
      call_analysis: {
        call_summary: "User inquired about insurance.",
        user_sentiment: "Positive",
        call_successful: true,
        custom_analysis_data: {
          detailed_call_summary: "User is interested in life insurance and wants a follow-up.",
          customer_name: "John Doe",
          customer_phone: "+1234567890",
          customer_email: "john@example.com",
          requested_products: ["Life Insurance"],
          follow_up_required: true,
          conversion_probability: 85
        }
      },
      latency: { p50: 100, p90: 200, p99: 500 },
      token_usage: { total_tokens: 1000, prompt_tokens: 600, completion_tokens: 400 },
      call_cost: 0.05
    }
  };

  it("should correctly parse the payload", () => {
    const parsed = parseRetailAICall(samplePayload);

    expect(parsed.conversationId).toBe("test-call-id");
    expect(parsed.customer.name).toBe("John Doe");
    expect(parsed.customer.phone).toBe("+1234567890");
    expect(parsed.customer.email).toBe("john@example.com");
    expect(parsed.durationMinutes).toBe(2);
    expect(parsed.callSuccessful).toBe(true);
    expect(parsed.sentiment).toBe("positive");
    expect(parsed.insights.products).toContain("Life Insurance");
    expect(parsed.insights.followUpRequired).toBe(true);
    expect(parsed.insights.conversionProbability).toBe(85);
    expect(parsed.confidenceScore).toBeGreaterThan(80);
    expect(parsed.recordingUrl).toBe("https://recording.url");
  });

  it("should handle missing optional fields", () => {
    const minimalPayload: RetailAIPayload = {
      event: "call_analyzed",
      call: {
        call_id: "min-call-id",
        transcript: "...",
        start_timestamp: 1716634800000,
        end_timestamp: 1716634860000,
        duration_ms: 60000
      }
    };

    const parsed = parseRetailAICall(minimalPayload);
    expect(parsed.conversationId).toBe("min-call-id");
    expect(parsed.customer.name).toBeUndefined();
    expect(parsed.callSuccessful).toBe(false);
    expect(parsed.confidenceScore).toBe(50);
  });

  it("should handle top-level conversation webhook fields", () => {
    const parsed = parseRetailAICall({
      event: "conversation_completed",
      call_id: "top-level-call-id",
      event_timestamp: "2026-05-25T10:00:00.000Z",
      total_duration_seconds: 150,
      transcript: [
        { role: "agent", content: "Hello" },
        { role: "user", content: "Book an appointment" },
      ],
      call_analysis: {
        call_summary: "Appointment booked for product demo.",
        call_successful: true,
        user_sentiment: "positive",
        custom_analysis_data: {
          detailed_call_summary: "Customer booked a demo appointment.",
          appointment_status: "booked",
        },
      },
    } as RetailAIPayload);

    expect(parsed.conversationId).toBe("top-level-call-id");
    expect(parsed.eventTimestamp.toISOString()).toBe("2026-05-25T10:00:00.000Z");
    expect(parsed.durationMinutes).toBe(3);
    expect(parsed.appointment.booked).toBe(true);
    expect(parsed.sentiment).toBe("positive");
  });

  it("should parse successful outbound PSTN phone_call payloads", () => {
    const parsed = parseRetailAICall({
      event: "call_ended",
      call: {
        call_id: "outbound-phone-call-id",
        type: "phone_call",
        direction: "outbound",
        call_status: "ended",
        to_number: "+15551234567",
        from_number: "+15557654321",
        transcript: "Agent: Hello Dave. User: I am Dave and I would like an appointment.",
        recording_url: "https://recording.example/outbound.wav",
        duration_ms: 90000,
        call_analysis: {
          call_summary: "Dave requested an appointment.",
          user_sentiment: "positive",
          call_successful: true,
          custom_analysis_data: {
            customer_name: "Dave",
            appointment_status: "booked",
            appointment_date: "2026-05-29",
            appointment_time: "10:00",
          },
        },
      },
    } as RetailAIPayload);

    expect(parsed.conversationId).toBe("outbound-phone-call-id");
    expect(parsed.customer.name).toBe("Dave");
    expect(parsed.customer.phone).toBe("+15551234567");
    expect(parsed.metadata.call_direction).toBe("outbound");
    expect(parsed.metadata.call_type).toBe("phone_call");
    expect(parsed.metadata.call_status).toBe("ended");
    expect(parsed.callSuccessful).toBe(true);
    expect(parsed.appointment.booked).toBe(true);
    expect(parsed.recordingUrl).toBe("https://recording.example/outbound.wav");
  });

  it("extracts fallback fields from transcript when analysis fields are missing", () => {
    const parsed = parseRetailAICall({
      event: "call_ended",
      call: {
        call_id: "fallback-transcript-call-id",
        direction: "outbound",
        to_number: "+15551234567",
        start_timestamp: 1779976800000,
        end_timestamp: 1779977100000,
        transcript_object: [
          { role: "agent", content: "Hi, who am I speaking with today?" },
          { role: "user", content: "My name is Dave and I am interested in life insurance." },
          { role: "agent", content: "Perfect, Dave. I have your online consultation at 7 PM confirmed." },
          { role: "user", content: "Great, thank you." },
        ],
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBe("Dave");
    expect(parsed.appointment.appointmentTime).toBeInstanceOf(Date);
    expect(parsed.appointment.appointmentTime?.getHours()).toBe(19);
    expect(parsed.summary).toContain("Dave completed a Retail AI call");
    expect(parsed.sentiment).toBe("positive");
  });

  it("rejects assistant names from customer fields and uses the user identity statement", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "assistant-name-rejected-call-id",
        direction: "outbound",
        to_number: "+15551234567",
        metadata: {
          agent_name: "Rita",
        },
        transcript_object: [
          { role: "agent", content: "Hi, this is Rita from BlueTide Financial. Who am I speaking with?" },
          { role: "user", content: "My name is Sarah Johnson." },
          { role: "agent", content: "Nice to meet you, Sarah. I can help with that." },
        ],
        call_analysis: {
          custom_analysis_data: {
            customer_name: "Rita",
            assistant_name: "Rita",
          },
        },
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBe("Sarah Johnson");
  });

  it("does not use agent confirmation when the user did not state their name", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "agent-confirmation-name-call-id",
        direction: "outbound",
        to_number: "+15551234567",
        transcript_object: [
          { role: "agent", content: "Hi, this is the AI assistant calling." },
          { role: "user", content: "Yes, I can talk now." },
          { role: "agent", content: "Okay Michael, I have your appointment request here." },
        ],
        call_analysis: {
          custom_analysis_data: {
            customer_name: "AI Assistant",
          },
        },
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBeUndefined();
  });

  it("does not fallback to the agent identity when no customer name is present", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "no-customer-name-call-id",
        direction: "outbound",
        to_number: "+15551234567",
        transcript_object: [
          { role: "agent", content: "Hi, this is Rita from BlueTide Financial." },
          { role: "user", content: "I want to hear about life insurance." },
        ],
        call_analysis: {
          custom_analysis_data: {
            customer_name: "Rita",
            agent_name: "Rita",
          },
        },
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBeUndefined();
  });

  it("extracts the earliest valid name from user transcript messages only", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "earliest-user-name-call-id",
        transcript_object: [
          { role: "agent", content: "Hi, this is Rita. Who am I speaking with?" },
          { role: "user", content: "I am Manasan." },
          { role: "user", content: "My name is Dale." },
        ],
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBe("Manasan");
  });

  it("extracts direct user name replies and spoken email prefixes", () => {
    const directReply = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "direct-user-name-call-id",
        transcript_object: [
          { role: "agent", content: "Who am I speaking with?" },
          { role: "user", content: "Dale." },
        ],
      },
    } as RetailAIPayload);

    const spokenEmail = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "spoken-email-name-call-id",
        transcript_object: [
          { role: "agent", content: "Can I get your email?" },
          { role: "user", content: "Divya at gmail dot com." },
        ],
      },
    } as RetailAIPayload);

    expect(directReply.customer.name).toBe("Dale");
    expect(spokenEmail.customer.name).toBe("Divya");
  });

  it("rejects non-customer fallback strings from user messages", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "invalid-user-name-call-id",
        transcript_object: [
          { role: "agent", content: "Who am I speaking with?" },
          { role: "user", content: "my first call" },
        ],
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBeUndefined();
  });

  it("prioritizes explicit user identity over earlier greeting-like direct replies", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "greeting-before-name-call-id",
        transcript_object: [
          { role: "agent", content: "Good evening. Whats your name?" },
          { role: "user", content: "Evening" },
          { role: "user", content: "My name is Harry." },
        ],
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBe("Harry");
  });

  it("rejects greeting words as direct user name replies", () => {
    const parsed = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "greeting-only-call-id",
        transcript_object: [
          { role: "agent", content: "Whats your name?" },
          { role: "user", content: "Evening" },
        ],
      },
    } as RetailAIPayload);

    expect(parsed.customer.name).toBeUndefined();
  });

  it("persists only locked user-transcript customer names", () => {
    const withName = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "persist-user-name-call-id",
        transcript_object: [
          { role: "agent", content: "Whats your name?" },
          { role: "user", content: "My name is Harry." },
        ],
      },
    } as RetailAIPayload);

    const withoutName = parseRetailAICall({
      event: "call_analyzed",
      call: {
        call_id: "do-not-persist-fallback-name-call-id",
        transcript_object: [
          { role: "agent", content: "Good evening. Whats your name?" },
          { role: "user", content: "Evening" },
        ],
      },
    } as RetailAIPayload);

    expect(mapParsedRetailAICallToActivity(withName).customer_name).toBe("Harry");
    expect(mapParsedRetailAICallToActivity(withoutName).customer_name).toBeNull();
  });
});
