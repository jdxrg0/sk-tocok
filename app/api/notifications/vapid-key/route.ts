import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/webPush";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Web push notifications are not configured on the server." },
      { status: 503 }
    );
  }
  return NextResponse.json({ publicKey });
}
