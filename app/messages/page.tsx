import type { Metadata } from "next";
import AnonymousCouncilMessages from "@/components/AnonymousCouncilMessages";

export const metadata: Metadata = {
  title: "Bumo-Boses | SK Tocok Portal",
  description:
    "Voice your suggestions, community project ideas, feedback, or inquiries anonymously to the Sangguniang Kabataan Council of Barangay Tocok.",
};

export default function MessagesPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-8 pb-24 md:pb-16 font-sans">
      <AnonymousCouncilMessages mode="public" />
    </div>
  );
}
