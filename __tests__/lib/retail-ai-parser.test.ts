import { parseRetailAICall, RetailAIPayload } from "@/lib/retail-ai/parser";

describe("Retail AI Parser", () => {
  const samplePayload: RetailAIPayload = {
    event: "call_analyzed",
    call: {
      call_id: "test-call-id",
      transcript: "Agent: Hello, User: Hi, I want to buy insurance.",
      transcript_object: [
        { role: "agent", content: "Hello" },
        { role: "user", content: "Hi, I want to buy insurance." }
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
    expect(parsed.customer.name).toBe("Unknown Caller");
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
        transcript: "Agent: Hello Dave. User: I would like an appointment.",
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
});
