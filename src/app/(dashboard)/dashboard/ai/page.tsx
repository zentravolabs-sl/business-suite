import { AIAssistantClient } from "@/components/ai/ai-assistant-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Business Assistant | Zentravo BMS",
};

export default function AIAssistantPage() {
  return <AIAssistantClient />;
}
