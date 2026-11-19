import { redirect } from "next/navigation";

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  if (params?.code) {
    redirect(`/printing?tab=track&code=${encodeURIComponent(params.code)}`);
  }
  redirect("/printing?tab=track");
}
