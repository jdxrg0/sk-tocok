import type { Metadata } from "next";
import AttendanceTracker from "@/components/AttendanceTracker";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "SK Officials Attendance | SK Tocok Portal",
  description:
    "Track attendance of Sangguniang Kabataan ng Barangay Tocok officials in Regular Sessions and community activities to see who is actively serving.",
};

export default function AttendancePage() {
  return <AttendanceTracker mode="public" />;
}
