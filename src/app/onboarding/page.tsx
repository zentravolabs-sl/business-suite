import type { Metadata } from "next";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export const metadata: Metadata = {
  title: "Business Onboarding | Zentravo BMS",
  description: "Set up your business, branches, currency, and tax configurations in Zentravo BMS.",
};

export default function OnboardingPage() {
  return <OnboardingWizard />;
}
