import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { courses } from "../../../db/schema";

function userId(request: Request) { return request.headers.get("oai-authenticated-user-id"); }

export async function GET(request: Request) {
  const id = userId(request);
  if (!id) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const rows = await getDb().select().from(courses).where(eq(courses.userId, id)).orderBy(asc(courses.day), asc(courses.startMinutes));
    return Response.json({ courses: rows });
  } catch (error) {
    console.error("schedule.get", error);
    return Response.json({ error: "시간표를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const id = userId(request);
  if (!id) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  try {
    const body = await request.json() as { courses?: Array<{ name?: string; day?: number; startMinutes?: number; endMinutes?: number }> };
    const clean = (body.courses ?? []).map((course) => ({
      userId: id,
      name: String(course.name ?? "").trim().slice(0, 80),
      day: Number(course.day),
      startMinutes: Number(course.startMinutes),
      endMinutes: Number(course.endMinutes),
    })).filter((course) => course.name && course.day >= 0 && course.day <= 4 && course.startMinutes >= 0 && course.endMinutes > course.startMinutes && course.endMinutes <= 1440);
    const db = getDb();
    await db.delete(courses).where(eq(courses.userId, id));
    if (clean.length) await db.insert(courses).values(clean);
    return Response.json({ ok: true, count: clean.length });
  } catch (error) {
    console.error("schedule.post", error);
    return Response.json({ error: "시간표를 저장하지 못했습니다." }, { status: 500 });
  }
}
