import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";
import {
  ensureAttendanceTables,
  isRegularSessionType,
  getActivityStanding,
  getOfficialRoleRank,
  type AttendanceStatus,
  type AttendanceSessionItem,
  type MonthlyAttendanceTrend,
  type OfficialAttendanceStat,
  type OfficialBase,
} from "@/lib/attendance";

export const dynamic = "force-dynamic";

interface RawSessionRow {
  id: number;
  title: string;
  activity_type: string;
  session_date: string;
  location: string | null;
  description: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
  proof_photos?: string | null;
}

interface RawRecordRow {
  session_id: number;
  user_id: number;
  status: string;
}

export async function GET(request: Request) {
  try {
    await ensureAttendanceTables();

    const { searchParams } = new URL(request.url);
    const typeFilter = (searchParams.get("type") || "all").trim();
    const yearFilter = (searchParams.get("year") || "all").trim();
    const searchQuery = (searchParams.get("q") || "").trim();

    // Fetch SK officials (exclude non-official Student accounts) & available years in parallel
    const [officialsRows, yearsRows] = await Promise.all([
      sql`
        SELECT id, name, role, contact_number, avatar_url
        FROM users
        WHERE LOWER(TRIM(COALESCE(role, ''))) NOT IN ('student', 'guest', '')
        ORDER BY id ASC
      `,
      sql`
        SELECT DISTINCT SUBSTRING(session_date, 1, 4) AS year
        FROM attendance_sessions
        WHERE LENGTH(session_date) >= 4
        ORDER BY year DESC
      `,
    ]);

    const officialsList = (officialsRows as OfficialBase[]).map((u) => ({
      id: Number(u.id),
      name: String(u.name || ""),
      role: String(u.role || "SK Official"),
      contact_number: u.contact_number ? String(u.contact_number) : null,
      avatar_url: u.avatar_url ? String(u.avatar_url) : null,
    }));

    // Build dynamic WHERE clause for sessions
    const conditions: string[] = ["1=1"];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (typeFilter === "regular") {
      conditions.push(`LOWER(activity_type) = 'regular session'`);
    } else if (typeFilter === "other") {
      conditions.push(`LOWER(activity_type) != 'regular session'`);
    } else if (typeFilter !== "all" && typeFilter !== "") {
      conditions.push(`LOWER(activity_type) = LOWER($${paramIdx++})`);
      params.push(typeFilter);
    }

    if (yearFilter !== "all" && /^\d{4}$/.test(yearFilter)) {
      conditions.push(`SUBSTRING(session_date, 1, 4) = $${paramIdx++}`);
      params.push(yearFilter);
    }

    if (searchQuery) {
      const pattern = `%${searchQuery}%`;
      conditions.push(
        `(title ILIKE $${paramIdx} OR activity_type ILIKE $${paramIdx + 1} OR COALESCE(location, '') ILIKE $${paramIdx + 2} OR COALESCE(description, '') ILIKE $${paramIdx + 3})`
      );
      params.push(pattern, pattern, pattern, pattern);
      paramIdx += 4;
    }

    const sessionRows = await query<RawSessionRow>(
      `SELECT id, title, activity_type, session_date, location, description, recorded_by, created_at, updated_at, proof_photos
       FROM attendance_sessions
       WHERE ${conditions.join(" AND ")}
       ORDER BY session_date DESC, id DESC`,
      params
    );

    const sessionIds = sessionRows.map((s) => Number(s.id));
    let recordRows: RawRecordRow[] = [];

    if (sessionIds.length > 0) {
      recordRows = await query<RawRecordRow>(
        `SELECT session_id, user_id, status
         FROM attendance_records
         WHERE session_id = ANY($1::int[])`,
        [sessionIds]
      );
    }

    // Group attendance records by session_id -> Map<user_id, status>
    const sessionRecordMap = new Map<number, Map<number, AttendanceStatus>>();
    for (const r of recordRows) {
      const sid = Number(r.session_id);
      const uid = Number(r.user_id);
      const status: AttendanceStatus = r.status === "Present" ? "Present" : "Absent";
      let map = sessionRecordMap.get(sid);
      if (!map) {
        map = new Map<number, AttendanceStatus>();
        sessionRecordMap.set(sid, map);
      }
      map.set(uid, status);
    }

    const officialIds = officialsList.map((o) => o.id);
    const totalOfficialsCount = officialsList.length;

    // Build formatted sessions list (newest first)
    const sessions: AttendanceSessionItem[] = sessionRows.map((s) => {
      const sid = Number(s.id);
      const map = sessionRecordMap.get(sid) || new Map<number, AttendanceStatus>();
      const records = officialIds.map((uid) => ({
        user_id: uid,
        status: (map.get(uid) ?? "Absent") as AttendanceStatus,
      }));
      const presentCount = records.filter((r) => r.status === "Present").length;
      const absentCount = records.length - presentCount;
      const attendanceRate =
        records.length > 0 ? Number(((presentCount / records.length) * 100).toFixed(1)) : 0;

      let proof_photos: string[] = [];
      if (s.proof_photos) {
        try {
          const parsed = typeof s.proof_photos === "string" ? JSON.parse(s.proof_photos) : s.proof_photos;
          if (Array.isArray(parsed)) {
            proof_photos = parsed.map(String).filter(Boolean);
          }
        } catch {
          proof_photos = [];
        }
      }

      return {
        id: sid,
        title: String(s.title),
        activity_type: String(s.activity_type || "Regular Session"),
        session_date: String(s.session_date),
        location: s.location ? String(s.location) : null,
        description: s.description ? String(s.description) : null,
        recorded_by: s.recorded_by ? String(s.recorded_by) : null,
        proof_photos,
        created_at: String(s.created_at),
        updated_at: String(s.updated_at),
        presentCount,
        absentCount,
        totalCount: records.length,
        attendanceRate,
        records,
      };
    });

    // Compute per-official attendance metrics
    const officials: OfficialAttendanceStat[] = officialsList.map((official) => {
      let presentCount = 0;
      let absentCount = 0;
      let regularPresent = 0;
      let regularTotal = 0;
      let otherPresent = 0;
      let otherTotal = 0;
      let lastAttendedDate: string | null = null;
      let currentStreak = 0;
      let streakBroken = false;

      const recentStatuses: OfficialAttendanceStat["recentStatuses"] = [];

      // sessions are already ordered newest -> oldest
      for (const session of sessions) {
        const map = sessionRecordMap.get(session.id);
        const status: AttendanceStatus = map?.get(official.id) === "Present" ? "Present" : "Absent";
        const isRegular = isRegularSessionType(session.activity_type);

        if (status === "Present") {
          presentCount += 1;
          if (!lastAttendedDate) {
            lastAttendedDate = session.session_date;
          }
          if (!streakBroken) {
            currentStreak += 1;
          }
        } else {
          absentCount += 1;
          streakBroken = true;
        }

        if (isRegular) {
          regularTotal += 1;
          if (status === "Present") regularPresent += 1;
        } else {
          otherTotal += 1;
          if (status === "Present") otherPresent += 1;
        }

        if (recentStatuses.length < 10) {
          recentStatuses.push({
            sessionId: session.id,
            title: session.title,
            date: session.session_date,
            activityType: session.activity_type,
            status,
          });
        }
      }

      const totalCount = sessions.length;
      const overallRate =
        totalCount > 0 ? Number(((presentCount / totalCount) * 100).toFixed(1)) : 0;
      const regularRate =
        regularTotal > 0 ? Number(((regularPresent / regularTotal) * 100).toFixed(1)) : 0;
      const otherRate =
        otherTotal > 0 ? Number(((otherPresent / otherTotal) * 100).toFixed(1)) : 0;
      const standing = getActivityStanding(overallRate, totalCount).key;

      return {
        ...official,
        presentCount,
        absentCount,
        totalCount,
        overallRate,
        regularPresent,
        regularTotal,
        regularRate,
        otherPresent,
        otherTotal,
        otherRate,
        lastAttendedDate,
        currentStreak,
        standing,
        recentStatuses,
      };
    });

    // Default sort by overallRate desc, then presentCount desc, then hierarchy rank
    officials.sort((a, b) => {
      if (b.overallRate !== a.overallRate) return b.overallRate - a.overallRate;
      if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount;
      const rankDiff = getOfficialRoleRank(a.role) - getOfficialRoleRank(b.role);
      if (rankDiff !== 0) return rankDiff;
      return a.id - b.id;
    });

    // Summary metrics
    const regularSessions = sessions.filter((s) => isRegularSessionType(s.activity_type));
    const otherActivities = sessions.filter((s) => !isRegularSessionType(s.activity_type));

    const averageAttendanceRate =
      sessions.length > 0
        ? Number(
            (
              sessions.reduce((acc, s) => acc + s.attendanceRate, 0) / sessions.length
            ).toFixed(1)
          )
        : 0;

    const regularAverageRate =
      regularSessions.length > 0
        ? Number(
            (
              regularSessions.reduce((acc, s) => acc + s.attendanceRate, 0) /
              regularSessions.length
            ).toFixed(1)
          )
        : 0;

    const otherAverageRate =
      otherActivities.length > 0
        ? Number(
            (
              otherActivities.reduce((acc, s) => acc + s.attendanceRate, 0) /
              otherActivities.length
            ).toFixed(1)
          )
        : 0;

    const activeOfficialsCount = officials.filter(
      (o) => o.standing === "highly_active" || o.standing === "active"
    ).length;
    const highlyActiveCount = officials.filter((o) => o.standing === "highly_active").length;
    const lowActivityCount = officials.filter((o) => o.standing === "low_activity").length;

    const topOfficial =
      sessions.length > 0 && officials.length > 0
        ? {
            id: officials[0].id,
            name: officials[0].name,
            role: officials[0].role,
            overallRate: officials[0].overallRate,
            presentCount: officials[0].presentCount,
            totalCount: officials[0].totalCount,
          }
        : null;

    // Monthly trend (chronological order)
    const monthBuckets = new Map<
      string,
      {
        regRates: number[];
        otherRates: number[];
        allRates: number[];
      }
    >();

    for (const s of sessions) {
      const month = s.session_date.slice(0, 7);
      if (!month) continue;
      let bucket = monthBuckets.get(month);
      if (!bucket) {
        bucket = { regRates: [], otherRates: [], allRates: [] };
        monthBuckets.set(month, bucket);
      }
      bucket.allRates.push(s.attendanceRate);
      if (isRegularSessionType(s.activity_type)) {
        bucket.regRates.push(s.attendanceRate);
      } else {
        bucket.otherRates.push(s.attendanceRate);
      }
    }

    const monthlyTrend: MonthlyAttendanceTrend[] = Array.from(monthBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, b]) => ({
        month,
        regularRate:
          b.regRates.length > 0
            ? Number((b.regRates.reduce((x, y) => x + y, 0) / b.regRates.length).toFixed(1))
            : null,
        otherRate:
          b.otherRates.length > 0
            ? Number((b.otherRates.reduce((x, y) => x + y, 0) / b.otherRates.length).toFixed(1))
            : null,
        overallRate: Number(
          (b.allRates.reduce((x, y) => x + y, 0) / Math.max(1, b.allRates.length)).toFixed(1)
        ),
        regularCount: b.regRates.length,
        otherCount: b.otherRates.length,
        totalSessions: b.allRates.length,
      }));

    const availableYears = (yearsRows as { year: string }[])
      .map((r) => String(r.year))
      .filter((y) => /^\d{4}$/.test(y));

    return NextResponse.json({
      success: true,
      summary: {
        totalSessions: sessions.length,
        regularSessionsCount: regularSessions.length,
        otherActivitiesCount: otherActivities.length,
        averageAttendanceRate,
        regularAverageRate,
        otherAverageRate,
        activeOfficialsCount,
        highlyActiveCount,
        lowActivityCount,
        totalOfficialsCount,
        mostActiveOfficial: topOfficial,
      },
      officials,
      sessions,
      monthlyTrend,
      availableYears,
    });
  } catch (error) {
    console.error("Attendance GET error:", error);
    return NextResponse.json(
      { error: "Failed to load SK attendance data." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized access. Please log in as an SK Official." },
        { status: 401 }
      );
    }
    if (!isOfficialUser(user)) {
      return NextResponse.json(
        { error: "Forbidden: Only SK Officials can record attendance." },
        { status: 403 }
      );
    }

    await ensureAttendanceTables();

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
    const proofPhotosJson = JSON.stringify(proofPhotosArr);

    if (!title) {
      return NextResponse.json({ error: "Session or activity title is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      return NextResponse.json({ error: "Please provide a valid date (YYYY-MM-DD)." }, { status: 400 });
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

    const inserted = await sql`
      INSERT INTO attendance_sessions (title, activity_type, session_date, location, description, recorded_by, proof_photos)
      VALUES (
        ${title},
        ${activityType || "Regular Session"},
        ${sessionDate},
        ${location},
        ${description},
        ${`${user.name} (${user.role})`},
        ${proofPhotosJson}
      )
      RETURNING id
    `;
    const sessionId = Number((inserted[0] as { id: number }).id);

    if (officialIds.length > 0) {
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
      id: sessionId,
      message: "Attendance record saved successfully.",
    });
  } catch (error) {
    console.error("Attendance POST error:", error);
    return NextResponse.json(
      { error: "Failed to save attendance record." },
      { status: 500 }
    );
  }
}
