import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { cookies } from "next/headers";

import { memoryModel } from "@/lib/model";

// Allow streaming responses up to 30 seconds.
export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  const { messages }: { messages: UIMessage[] } = await request.json();

  // Per-user memory bank (set by middleware.ts).
  const userId = (await cookies()).get("il_uid")?.value ?? "anonymous";

  const result = streamText({
    model: memoryModel(userId),
    system:
      "You are a helpful assistant with long-term memory of this user. " +
      "When relevant memory is provided, use it to personalize your answer.",
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
