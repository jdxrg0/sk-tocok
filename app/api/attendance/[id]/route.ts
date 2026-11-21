import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import { ensureAttendanceTables, type AttendanceStatus } from "@/lib/attendance";
import { deleteStoredFileByUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json(
        { error: "Forbidden: Only SK Officials can update attendance." },
        { status: 403 }
      );
    }

    await ensureAttendanceTables();

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM attendance_sessions WHERE id = ${sessionId}`;
    if (existing.length === 0) {
      return NextResponse.json({ error: "Attendance session not found." }, { status: 404 });
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const activityType = String(body.activity_type || "Regular Session").trim();
    const sessionDate = String(body.session_date || "").trim();
    const location = String(body.location || "").trim() || null;
    const description = String(body.description || "").trim() || null;
    const attendanceMapInput = body.attendance as Record<string, string> | undefined;
    const recordsInput = Array.isArray(body.records)
      ? (body.records as { user_id: number; status: string }[])
      : null;

    if (!title) {
      return NextResponse.json({ error: "Session or activity title is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      return NextResponse.json({ error: "Please provide a valid date (YYYY-MM-DD)." }, { status: 400 });
    }

    let proofPhotosJson: string | null = null;
    if (body.proof_photos !== undefined) {
      let proofPhotosArr: string[] = [];
      if (Array.isArray(body.proof_photos)) {
        proofPhotosArr = body.proof_photos.map(String).filter(Boolean);
      } else if (typeof body.proof_photos === "string" && body.proof_photos.trim()) {
        try {
          const p = JSON.parse(body.proof_photos);
          if (Array.isArray(p)) proofPhotosArr = p.map(String).filter(Boolean);
          else proofPhotosArr = [body.proof_photos.trim()];
        } catch {
          proofPhotosArr = [body.proof_photos.trim()];
        }
      }
      proofPhotosJson = JSON.stringify(proofPhotosArr);
    }

    if (proofPhotosJson !== null) {
      await sql`
        UPDATE attendance_sessions
        SET title = ${title},
            activity_type = ${activityType || "Regular Session"},
            session_date = ${sessionDate},
            location = ${location},
            description = ${description},
            proof_photos = ${proofPhotosJson},
            updated_at = NOW()
        WHERE id = ${sessionId}
      `;
    } else {
      await sql`
        UPDATE attendance_sessions
        SET title = ${title},
            activity_type = ${activityType || "Regular Session"},
            session_date = ${sessionDate},
            location = ${location},
            description = ${description},
            updated_at = NOW()
        WHERE id = ${sessionId}
      `;
    }

    const officialRows = await sql`
      SELECT id FROM users WHERE LOWER(TRIM(COALESCE(role, ''))) NOT IN ('student', 'guest', '') ORDER BY id ASC
    `;
    const officialIds = (officialRows as { id: number }[]).map((r) => Number(r.id));

    const statusByUser = new Map<number, AttendanceStatus>();
    if (recordsInput) {
      for (const rec of recordsInput) {
        statusByUser.set(Number(rec.user_id), rec.status === "Present" ? "Present" : "Absent");
      }
    } else if (attendanceMapInput && typeof attendanceMapInput === "object") {
      for (const [uidStr, st] of Object.entries(attendanceMapInput)) {
        statusByUser.set(Number(uidStr), st === "Present" ? "Present" : "Absent");
      }
    }

    if (officialIds.length > 0 && (recordsInput || attendanceMapInput)) {
      const statuses = officialIds.map((uid) => statusByUser.get(uid) ?? "Absent");
      await query(
        `INSERT INTO attendance_records (session_id, user_id, status)
         SELECT $1::int, u_id, st
         FROM UNNEST($2::int[], $3::text[]) AS t(u_id, st)
         ON CONFLICT (session_id, user_id)
         DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()`,
        [sessionId, officialIds, statuses]
      );
    }

    return NextResponse.json({
      success: true,
      message: "Attendance record updated successfully.",
    });
  } catch (error) {
    console.error("Attendance PUT error:", error);
    return NextResponse.json(
      { error: "Failed to update attendance record." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json(
        { error: "Forbidden: Only SK Officials can delete attendance records." },
        { status: 403 }
      );
    }

    await ensureAttendanceTables();

    const { id } = await params;
    const sessionId = parseInt(id, 10);
    if (!sessionId || Number.isNaN(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID." }, { status: 400 });
    }

    const deleted = await sql`
      DELETE FROM attendance_sessions
      WHERE id = ${sessionId}
      RETURNING id, proof_photos
    `;

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Attendance session not found." }, { status: 404 });
    }

    const rawPhotos = (deleted[0] as { proof_photos?: string | null })?.proof_photos;
    if (rawPhotos) {
      try {
        const parsed = JSON.parse(rawPhotos);
        if (Array.isArray(parsed)) {
          for (const url of parsed) {
            if (typeof url === "string") {
              await deleteStoredFileByUrl(url);
            }
          }
        }
      } catch {
        // Ignore JSON parse cleanup failure
      }
    }

    return NextResponse.json({
      success: true,
      message: "Attendance session removed successfully.",
    });
  } catch (error) {
    console.error("Attendance DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to delete attendance session." },
      { status: 500 }
    );
  }
}
