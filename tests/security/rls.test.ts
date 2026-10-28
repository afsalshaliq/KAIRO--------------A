import { describe, it, expect, beforeAll } from "vitest";
import { bootDb, type Harness } from "./harness";

/**
 * These tests run the REAL migrations in an in-process Postgres and execute
 * queries under a non-owner `authenticated` role, so RLS policies and the
 * profile-privilege trigger are genuinely enforced (not mocked).
 */
describe("Row-Level Security", () => {
  let h: Harness;
  let adminId: string, teacherA: string, teacherB: string, suspended: string;
  let classId: string, sectionId: string, subjectId: string, otherSubjectId: string;

  // material ids
  let readyPublishedAssigned: string;
  let readyPublishedUnassigned: string;
  let unpublished: string;
  let notReady: string;

  beforeAll(async () => {
    h = await bootDb();
    adminId = await h.createUser({ email: "admin@royal.edu", role: "admin" });
    teacherA = await h.createUser({ email: "a@royal.edu", role: "teacher" });
    teacherB = await h.createUser({ email: "b@royal.edu", role: "teacher" });
    suspended = await h.createUser({ email: "s@royal.edu", role: "teacher", status: "suspended" });

    await h.asService(async () => {
      const cls = await h.db.query<{ id: string }>(
        `select id from classes where grade = 3 and academic_year = '2025-2026' limit 1`,
      );
      classId = cls.rows[0].id;
      const sec = await h.db.query<{ id: string }>(
        `select id from sections where class_id = $1 limit 1`, [classId],
      );
      sectionId = sec.rows[0].id;
      const subs = await h.db.query<{ id: string }>(`select id from subjects order by name limit 2`);
      subjectId = subs.rows[0].id;
      otherSubjectId = subs.rows[1].id;

      // teacherA assigned to (class, section, subject); teacherB assigned to a different subject.
      await h.db.query(
        `insert into teacher_assignments (teacher_id, class_id, section_id, subject_id)
         values ($1,$2,$3,$4)`, [teacherA, classId, sectionId, subjectId],
      );
      await h.db.query(
        `insert into teacher_assignments (teacher_id, class_id, section_id, subject_id)
         values ($1,$2,$3,$4)`, [teacherB, classId, sectionId, otherSubjectId],
      );

      const mk = async (status: string, published: boolean) => {
        const r = await h.db.query<{ id: string }>(
          `insert into curriculum_materials
             (title,class_id,section_id,subject_id,chapter,academic_year,file_path,mime_type,byte_size,status,is_published,uploaded_by)
           values ('M',$1,$2,$3,'Ch','2025-2026',gen_random_uuid()||'/f.txt','text/plain',10,$4,$5,$6) returning id`,
          [classId, sectionId, subjectId, status, published, adminId],
        );
        return r.rows[0].id;
      };
      readyPublishedAssigned = await mk("ready", true);
      readyPublishedUnassigned = await mk("ready", true); // assigned subject but we'll test teacherB (other subject)
      unpublished = await mk("ready", false);
      notReady = await mk("processing", true);

      // chunks for the accessible material
      await h.db.query(
        `insert into material_chunks (material_id, chunk_index, content, page_ref)
         values ($1, 0, 'Photosynthesis is how plants make food.', 5)`, [readyPublishedAssigned],
      );
      await h.db.query(
        `insert into material_chunks (material_id, chunk_index, content, page_ref)
         values ($1, 0, 'secret', 1)`, [unpublished],
      );

      // teacherA private content
      await h.db.query(
        `insert into activities (teacher_id, title, grade, subject, payload)
         values ($1,'A-activity',3,'Science','{}'::jsonb)`, [teacherA],
      );
      await h.db.query(
        `insert into generation_history (teacher_id, resource_type, title, payload)
         values ($1,'activity','A-history','{}'::jsonb)`, [teacherA],
      );
      const sess = await h.db.query<{ id: string }>(
        `insert into chat_sessions (teacher_id, material_id, title) values ($1,$2,'s') returning id`,
        [teacherA, readyPublishedAssigned],
      );
      await h.db.query(
        `insert into chat_messages (session_id, teacher_id, role, content)
         values ($1,$2,'user','hello')`, [sess.rows[0].id, teacherA],
      );
    });
  });

  it("classes are restricted to grades 1..5 (DB CHECK, not UI)", async () => {
    await expect(
      h.asService(async () => {
        await h.db.query(
          `insert into classes (grade, academic_year) values (6, '2025-2026')`,
        );
      }),
    ).rejects.toThrow();
  });

  it("teacher can read an assigned, ready, published material", async () => {
    const r = await h.actAs(teacherA, () =>
      h.db.query(`select id from curriculum_materials where id = $1`, [readyPublishedAssigned]),
    );
    expect(r.rows).toHaveLength(1);
  });

  it("teacher cannot read an unpublished material", async () => {
    const r = await h.actAs(teacherA, () =>
      h.db.query(`select id from curriculum_materials where id = $1`, [unpublished]),
    );
    expect(r.rows).toHaveLength(0);
  });

  it("teacher cannot read a not-ready (processing) material", async () => {
    const r = await h.actAs(teacherA, () =>
      h.db.query(`select id from curriculum_materials where id = $1`, [notReady]),
    );
    expect(r.rows).toHaveLength(0);
  });

  it("teacher cannot read a material for a subject they are not assigned to", async () => {
    // teacherB is assigned to otherSubject, so the subjectId material is off-limits.
    const r = await h.actAs(teacherB, () =>
      h.db.query(`select id from curriculum_materials where id = $1`, [readyPublishedUnassigned]),
    );
    expect(r.rows).toHaveLength(0);
  });

  it("teacher can read chunks of an accessible material, but not of an inaccessible one", async () => {
    const ok = await h.actAs(teacherA, () =>
      h.db.query(`select content from material_chunks where material_id = $1`, [readyPublishedAssigned]),
    );
    expect(ok.rows).toHaveLength(1);

    const blocked = await h.actAs(teacherA, () =>
      h.db.query(`select content from material_chunks where material_id = $1`, [unpublished]),
    );
    expect(blocked.rows).toHaveLength(0);
  });

  it("a teacher cannot read another teacher's activities / history / chats", async () => {
    const acts = await h.actAs(teacherB, () =>
      h.db.query(`select id from activities where teacher_id = $1`, [teacherA]),
    );
    expect(acts.rows).toHaveLength(0);

    const hist = await h.actAs(teacherB, () =>
      h.db.query(`select id from generation_history where teacher_id = $1`, [teacherA]),
    );
    expect(hist.rows).toHaveLength(0);

    const msgs = await h.actAs(teacherB, () =>
      h.db.query(`select content from chat_messages where teacher_id = $1`, [teacherA]),
    );
    expect(msgs.rows).toHaveLength(0);
  });

  it("admin analytics cannot read teachers' private generated content", async () => {
    // By design there is NO admin policy on activities/worksheets/quizzes/history.
    const acts = await h.actAs(adminId, () => h.db.query(`select id from activities`));
    expect(acts.rows).toHaveLength(0);
    const hist = await h.actAs(adminId, () => h.db.query(`select id from generation_history`));
    expect(hist.rows).toHaveLength(0);
  });

  it("a teacher cannot escalate their own role", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(`update profiles set role = 'admin' where id = $1`, [teacherA]),
      ),
    ).rejects.toThrow(/not authorized/i);
  });

  it("a teacher cannot un-suspend / change their own status", async () => {
    await expect(
      h.actAs(suspended, () =>
        h.db.query(`update profiles set status = 'active' where id = $1`, [suspended]),
      ),
    ).rejects.toThrow(/not authorized/i);
  });

  it("a teacher CAN update their own full_name", async () => {
    await h.actAs(teacherA, () =>
      h.db.query(`update profiles set full_name = 'Ms A' where id = $1`, [teacherA]),
    );
    const r = await h.asServiceQuery<{ full_name: string }>(
      `select full_name from profiles where id = $1`, [teacherA],
    );
    expect(r[0].full_name).toBe("Ms A");
  });

  it("a suspended teacher loses material access and cannot create resources", async () => {
    const read = await h.actAs(suspended, () =>
      h.db.query(`select id from curriculum_materials where id = $1`, [readyPublishedAssigned]),
    );
    expect(read.rows).toHaveLength(0);

    await expect(
      h.actAs(suspended, () =>
        h.db.query(
          `insert into activities (teacher_id, title, grade, subject, payload)
           values ($1,'x',3,'Science','{}'::jsonb)`, [suspended],
        ),
      ),
    ).rejects.toThrow();
  });

  it("a teacher cannot insert activities owned by someone else", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(
          `insert into activities (teacher_id, title, grade, subject, payload)
           values ($1,'spoof',3,'Science','{}'::jsonb)`, [teacherB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("audit_logs are immutable to authenticated users and private to non-admins", async () => {
    // seed one row as service role
    await h.asService(async () => {
      await h.db.query(
        `insert into audit_logs (actor_id, action, target) values ($1,'t.test','x')`, [adminId],
      );
    });

    // teacher cannot read
    const tRead = await h.actAs(teacherA, () => h.db.query(`select id from audit_logs`));
    expect(tRead.rows).toHaveLength(0);

    // admin can read
    const aRead = await h.actAs(adminId, () => h.db.query(`select id from audit_logs`));
    expect(aRead.rows.length).toBeGreaterThan(0);

    // No INSERT policy => inserts are rejected outright, even for an admin.
    await expect(
      h.actAs(adminId, () =>
        h.db.query(`insert into audit_logs (action, target) values ('hack','x')`),
      ),
    ).rejects.toThrow();

    // No UPDATE/DELETE policy => those statements match zero rows (RLS filters
    // everything), so existing audit rows are effectively immutable.
    const before = await h.asServiceQuery<{ n: string }>(`select count(*)::text as n from audit_logs`);
    const del = await h.actAs(adminId, () => h.db.query(`delete from audit_logs`));
    expect(del.affectedRows ?? 0).toBe(0);
    const upd = await h.actAs(adminId, () => h.db.query(`update audit_logs set action = 'tampered'`));
    expect(upd.affectedRows ?? 0).toBe(0);
    const after = await h.asServiceQuery<{ n: string }>(`select count(*)::text as n from audit_logs`);
    expect(after[0].n).toBe(before[0].n);
    const tampered = await h.asServiceQuery(`select id from audit_logs where action = 'tampered'`);
    expect(tampered).toHaveLength(0);
  });

  it("audit_logs older than 30 days are automatically deleted by retention cleanup", async () => {
    // 1. Insert an expired audit log (35 days ago) and a recent one (2 days ago)
    await h.asService(async () => {
      await h.db.query(
        `insert into audit_logs (action, target, created_at)
         values ('expired.trigger.action', 'old_record', now() - interval '35 days'),
                ('recent.action', 'new_record', now() - interval '2 days')`
      );
    });

    // Verify automatic trigger immediately cleaned up the row older than 30 days
    const expiredByTrigger = await h.asServiceQuery(
      `select id from audit_logs where action = 'expired.trigger.action'`
    );
    expect(expiredByTrigger).toHaveLength(0);

    const recent = await h.asServiceQuery(
      `select id from audit_logs where action = 'recent.action'`
    );
    expect(recent.length).toBeGreaterThan(0);

    // 2. Test manual invocation of cleanup_expired_audit_logs() by updating a row's age
    await h.asService(async () => {
      await h.db.query(
        `update audit_logs set created_at = now() - interval '40 days' where id = $1`,
        [recent[0].id]
      );
    });

    const deleted = await h.asServiceQuery<{ count: number }>(
      `select cleanup_expired_audit_logs() as count`
    );
    expect(Number(deleted[0].count)).toBeGreaterThanOrEqual(1);

    const expiredAfterManual = await h.asServiceQuery(
      `select id from audit_logs where id = $1`,
      [recent[0].id]
    );
    expect(expiredAfterManual).toHaveLength(0);
  });

  it("only admins may write reference data (classes/subjects)", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(`insert into subjects (name) values ('Hacking 101')`),
      ),
    ).rejects.toThrow();

    // admin can
    await h.actAs(adminId, () =>
      h.db.query(`insert into subjects (name) values ('Music')`),
    );
    const r = await h.asServiceQuery(`select id from subjects where name = 'Music'`);
    expect(r).toHaveLength(1);
  });

  it("storage: teacher can read an object only for an accessible material", async () => {
    await h.asService(async () => {
      await h.db.query(
        `insert into storage.buckets (id, name, public) values ('curriculum','curriculum',false)
         on conflict (id) do nothing`,
      );
      await h.db.query(
        `insert into storage.objects (bucket_id, name) values ('curriculum', $1)`,
        [`${readyPublishedAssigned}/f.txt`],
      );
      await h.db.query(
        `insert into storage.objects (bucket_id, name) values ('curriculum', $1)`,
        [`${unpublished}/f.txt`],
      );
    });

    const ok = await h.actAs(teacherA, () =>
      h.db.query(`select name from storage.objects where name = $1`, [`${readyPublishedAssigned}/f.txt`]),
    );
    expect(ok.rows).toHaveLength(1);

    const blocked = await h.actAs(teacherA, () =>
      h.db.query(`select name from storage.objects where name = $1`, [`${unpublished}/f.txt`]),
    );
    expect(blocked.rows).toHaveLength(0);
  });

  it("storage: teachers cannot upload (insert) curriculum objects", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(
          `insert into storage.objects (bucket_id, name) values ('curriculum', $1)`,
          [`${readyPublishedAssigned}/hack.txt`],
        ),
      ),
    ).rejects.toThrow();
  });
});

/**
 * The super_admin role sits above the principal (admin). The DB trigger
 * `guard_profile_privileges` must let a super admin manage every account while
 * a principal can only ever touch teachers — enforced in Postgres, not the UI.
 */
describe("Super admin privileges (role hierarchy)", () => {
  let h: Harness;
  let superId: string, principal: string, principal2: string, teacher: string;

  beforeAll(async () => {
    h = await bootDb();
    superId = await h.createUser({ email: "super@royal.edu", role: "super_admin" });
    principal = await h.createUser({ email: "p1@royal.edu", role: "admin" });
    principal2 = await h.createUser({ email: "p2@royal.edu", role: "admin" });
    teacher = await h.createUser({ email: "t1@royal.edu", role: "teacher" });
  });

  it("super admin can promote a teacher to principal (admin)", async () => {
    await h.actAs(superId, () =>
      h.db.query(`update profiles set role = 'admin' where id = $1`, [teacher]),
    );
    const r = await h.asServiceQuery<{ role: string }>(
      `select role from profiles where id = $1`, [teacher],
    );
    expect(r[0].role).toBe("admin");
  });

  it("super admin can suspend another administrator", async () => {
    await h.actAs(superId, () =>
      h.db.query(`update profiles set status = 'suspended' where id = $1`, [principal]),
    );
    const r = await h.asServiceQuery<{ status: string }>(
      `select status from profiles where id = $1`, [principal],
    );
    expect(r[0].status).toBe("suspended");
  });

  it("super admin can demote a principal back to teacher", async () => {
    await h.actAs(superId, () =>
      h.db.query(`update profiles set role = 'teacher' where id = $1`, [principal]),
    );
    const r = await h.asServiceQuery<{ role: string }>(
      `select role from profiles where id = $1`, [principal],
    );
    expect(r[0].role).toBe("teacher");
  });

  it("a principal CANNOT modify another administrator's account", async () => {
    await expect(
      h.actAs(principal2, () =>
        h.db.query(`update profiles set status = 'suspended' where id = $1`, [superId]),
      ),
    ).rejects.toThrow(/administrator accounts/i);
  });

  it("a principal CANNOT grant an administrator role (promote a teacher)", async () => {
    const t2 = await h.createUser({ email: "t2@royal.edu", role: "teacher" });
    await expect(
      h.actAs(principal2, () =>
        h.db.query(`update profiles set role = 'admin' where id = $1`, [t2]),
      ),
    ).rejects.toThrow(/grant administrator roles/i);
  });

  it("a principal CAN still suspend a teacher (status only, role unchanged)", async () => {
    const t3 = await h.createUser({ email: "t3@royal.edu", role: "teacher" });
    await h.actAs(principal2, () =>
      h.db.query(`update profiles set status = 'suspended' where id = $1`, [t3]),
    );
    const r = await h.asServiceQuery<{ status: string }>(
      `select status from profiles where id = $1`, [t3],
    );
    expect(r[0].status).toBe("suspended");
  });

  it("a principal CANNOT escalate themselves to super_admin", async () => {
    await expect(
      h.actAs(principal2, () =>
        h.db.query(`update profiles set role = 'super_admin' where id = $1`, [principal2]),
      ),
    ).rejects.toThrow(/administrator accounts|grant administrator roles|not authorized/i);
  });
});

/**
 * Object-level authorization: a teacher owns their rows, but must not be able to
 * REFERENCE objects outside their relationship — a material outside their
 * assignment scope, or another teacher's chat session. Reads were already
 * owner-scoped; these cases exercise the WITH CHECK hardening in 0007.
 */
describe("Object-level authorization (IDOR / BOLA)", () => {
  let h: Harness;
  let adminId: string, teacherA: string, teacherB: string;
  let classId: string, sectionId: string, subjA: string, subjB: string;
  let matA: string, matB: string;      // matA in teacherA's scope; matB is not
  let sessionA: string, sessionB: string;

  beforeAll(async () => {
    h = await bootDb();
    adminId = await h.createUser({ email: "adm@royal.edu", role: "admin" });
    teacherA = await h.createUser({ email: "ta@royal.edu", role: "teacher" });
    teacherB = await h.createUser({ email: "tb@royal.edu", role: "teacher" });

    await h.asService(async () => {
      classId = (await h.db.query<{ id: string }>(
        `select id from classes where grade = 3 and academic_year = '2025-2026' limit 1`,
      )).rows[0].id;
      sectionId = (await h.db.query<{ id: string }>(
        `select id from sections where class_id = $1 limit 1`, [classId],
      )).rows[0].id;
      const subs = (await h.db.query<{ id: string }>(`select id from subjects order by name limit 2`)).rows;
      subjA = subs[0].id; subjB = subs[1].id;

      // teacherA -> subjA ; teacherB -> subjB (disjoint scopes).
      await h.db.query(
        `insert into teacher_assignments (teacher_id,class_id,section_id,subject_id) values ($1,$2,$3,$4)`,
        [teacherA, classId, sectionId, subjA],
      );
      await h.db.query(
        `insert into teacher_assignments (teacher_id,class_id,section_id,subject_id) values ($1,$2,$3,$4)`,
        [teacherB, classId, sectionId, subjB],
      );

      const mk = async (subj: string) => (await h.db.query<{ id: string }>(
        `insert into curriculum_materials
           (title,class_id,section_id,subject_id,chapter,academic_year,file_path,mime_type,byte_size,status,is_published,uploaded_by)
         values ('M',$1,$2,$3,'Ch','2025-2026',gen_random_uuid()||'/f.txt','text/plain',10,'ready',true,$4) returning id`,
        [classId, sectionId, subj, adminId],
      )).rows[0].id;
      matA = await mk(subjA);
      matB = await mk(subjB);

      // One session per teacher (service role bypasses RLS to set up fixtures).
      sessionA = (await h.db.query<{ id: string }>(
        `insert into chat_sessions (teacher_id,material_id,title) values ($1,$2,'a') returning id`,
        [teacherA, matA],
      )).rows[0].id;
      sessionB = (await h.db.query<{ id: string }>(
        `insert into chat_sessions (teacher_id,material_id,title) values ($1,$2,'b') returning id`,
        [teacherB, matB],
      )).rows[0].id;
    });
  });

  it("teacher CAN save content referencing a material in their assignment scope", async () => {
    await h.actAs(teacherA, () =>
      h.db.query(
        `insert into activities (teacher_id,material_id,title,grade,subject,payload)
         values ($1,$2,'ok',3,'Science','{}'::jsonb)`, [teacherA, matA],
      ),
    );
    const r = await h.asServiceQuery(
      `select id from activities where teacher_id=$1 and material_id=$2`, [teacherA, matA],
    );
    expect(r).toHaveLength(1);
  });

  it("teacher CANNOT save an activity referencing an out-of-scope material (IDOR)", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(
          `insert into activities (teacher_id,material_id,title,grade,subject,payload)
           values ($1,$2,'idor',3,'Science','{}'::jsonb)`, [teacherA, matB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("teacher CANNOT save a worksheet / quiz / history referencing an out-of-scope material", async () => {
    for (const t of ["worksheets", "quizzes"]) {
      await expect(
        h.actAs(teacherA, () =>
          h.db.query(
            `insert into ${t} (teacher_id,material_id,title,grade,subject,payload)
             values ($1,$2,'idor',3,'Science','{}'::jsonb)`, [teacherA, matB],
          ),
        ),
      ).rejects.toThrow();
    }
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(
          `insert into generation_history (teacher_id,resource_type,material_id,title,payload)
           values ($1,'worksheet',$2,'idor','{}'::jsonb)`, [teacherA, matB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("teacher CANNOT create a chat session bound to an out-of-scope material", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(
          `insert into chat_sessions (teacher_id,material_id,title) values ($1,$2,'idor')`,
          [teacherA, matB],
        ),
      ),
    ).rejects.toThrow();
  });

  it("teacher CANNOT write a message into another teacher's chat session (IDOR)", async () => {
    await expect(
      h.actAs(teacherA, () =>
        h.db.query(
          `insert into chat_messages (session_id,teacher_id,role,content)
           values ($1,$2,'user','sneak')`, [sessionB, teacherA],
        ),
      ),
    ).rejects.toThrow();
  });

  it("teacher CAN write a message into their own chat session", async () => {
    await h.actAs(teacherA, () =>
      h.db.query(
        `insert into chat_messages (session_id,teacher_id,role,content)
         values ($1,$2,'user','hi')`, [sessionA, teacherA],
      ),
    );
    const r = await h.asServiceQuery(`select id from chat_messages where session_id=$1`, [sessionA]);
    expect(r.length).toBeGreaterThan(0);
  });
});
