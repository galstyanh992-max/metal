import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAction, requireRole } from "@/lib/rbac";
import { DOOR_PRESETS } from "@/lib/rolshutter/catalog";
import {
  DEFAULTS_KEY_PREFIX, gateDefaultsSchema, presetIdSchema, saveGateDefaultsSchema,
  type GateDefaultsResponse,
} from "@/lib/rolshutter/defaults";

export async function GET() {
  try {
    const { role } = await requireAction("order.create");
    const settings = await db.setting.findMany({
      where: { key: { in: DOOR_PRESETS.map((preset) => DEFAULTS_KEY_PREFIX + preset.id) } },
    });
    const defaults: GateDefaultsResponse["defaults"] = {};
    for (const setting of settings) {
      defaults[setting.key.slice(DEFAULTS_KEY_PREFIX.length)] = {
        config: gateDefaultsSchema.parse(JSON.parse(setting.value)),
        updatedAt: setting.updatedAt.toISOString(),
      };
    }
    return NextResponse.json({ defaults, canManage: role === "ADMIN" }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Gate defaults load failed", error);
    return NextResponse.json({ error: "Չհաջողվեց բեռնել լռելյայն կարգավորումները։ Փորձեք կրկին։" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { userId } = await requireRole("ADMIN");
    const parsed = saveGateDefaultsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Ստուգեք կարգավորումները, քանակները, գները և լրացուցիչ ապրանքների անունները։" }, { status: 400 });
    }
    const { presetId, config } = parsed.data;
    const key = DEFAULTS_KEY_PREFIX + presetId;
    const setting = await db.$transaction(async (tx) => {
      const before = await tx.setting.findUnique({ where: { key } });
      const value = JSON.stringify(config);
      const saved = await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
      await tx.auditLog.create({
        data: {
          actorId: userId, action: "rolshutter.defaults.save", entityType: "Setting", entityId: saved.id,
          beforeJson: before?.value ?? null, afterJson: value,
        },
      });
      return saved;
    });
    return NextResponse.json({ presetId, saved: { config, updatedAt: setting.updatedAt.toISOString() } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Gate defaults save failed", error);
    return NextResponse.json({ error: "Չհաջողվեց պահպանել կարգավորումները։ Փորձեք կրկին։" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { userId } = await requireRole("ADMIN");
    const parsed = presetIdSchema.safeParse(new URL(request.url).searchParams.get("presetId"));
    if (!parsed.success) return NextResponse.json({ error: "Անհայտ դարպասի տեսակ" }, { status: 400 });
    const key = DEFAULTS_KEY_PREFIX + parsed.data;
    await db.$transaction(async (tx) => {
      const before = await tx.setting.findUnique({ where: { key } });
      if (!before) return;
      await tx.setting.delete({ where: { key } });
      await tx.auditLog.create({
        data: {
          actorId: userId, action: "rolshutter.defaults.reset", entityType: "Setting",
          entityId: before.id, beforeJson: before.value,
        },
      });
    });
    return NextResponse.json({ presetId: parsed.data });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Gate defaults reset failed", error);
    return NextResponse.json({ error: "Չհաջողվեց վերականգնել սկզբնական կարգավորումները։" }, { status: 500 });
  }
}
