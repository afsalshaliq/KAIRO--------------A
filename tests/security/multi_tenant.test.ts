import { describe, it, expect, beforeAll } from "vitest";
import { bootDb, type Harness } from "./harness";

const ROYAL_SCHOOL_ID = "00000000-0000-0000-0000-000000000001";
const OXFORD_SCHOOL_ID = "00000000-0000-0000-0000-000000000002";

describe("Multi-Tenant Isolation & Role-Based Access Control", () => {
  let h: Harness;
  let superAdminId: string;
  let royalPrincipalId: string;
  let royalTeacherId: string;
  let royalTeacherAdminId: string;
  let oxfordPrincipalId: string;
  let oxfordTeacherId: string;

  let royalClassId: string;
  let oxfordClassId: string;
  let royalMaterialId: string;
  let oxfordMaterialId: string;
  let royalRequestId: string;
  let oxfordRequestId: string;

  beforeAll(async () => {
    h = await bootDb();

    // 1. Create users across tenants
    superAdminId = await h.createUser({
      email: "super@kairo.com",
      role: "super_admin",
      schoolId: null, // Global
    });

    royalPrincipalId = await h.createUser({
      email: "principal@royal.edu",
      role: "principal",
      schoolId: ROYAL_SCHOOL_ID,
    });

    royalTeacherId = await h.createUser({
      email: "teacher@royal.edu",
      role: "teacher",
      schoolId: ROYAL_SCHOOL_ID,
    });

    royalTeacherAdminId = await h.createUser({
      email: "teacheradmin@royal.edu",
      role: "teacher_admin",
      schoolId: ROYAL_SCHOOL_ID,
    });

    oxfordPrincipalId = await h.createUser({
      email: "principal@oxford.edu",
      role: "principal",
      schoolId: OXFORD_SCHOOL_ID,
    });

    oxfordTeacherId = await h.createUser({
      email: "teacher@oxford.edu",
      role: "teacher",
      schoolId: OXFORD_SCHOOL_ID,
    });

    // 2. Grant permissions to royalTeacherAdmin
    await h.asService(async () => {
      await h.db.query(
        `insert into teacher_admin_permissions (school_id, teacher_id, permission_code)
         values ($1, $2, 'school.request.review'), ($1, $2, 'school.audit.view')`,
        [ROYAL_SCHOOL_ID, royalTeacherAdminId],
      );

      // Create classes in both schools
      const rc = await h.db.query<{ id: string }>(
        `insert into classes (grade, academic_year, school_id) values (2, '2025-2026', $1) returning id`,
        [ROYAL_SCHOOL_ID],
      );
      royalClassId = rc.rows[0].id;

      const oc = await h.db.query<{ id: string }>(
        `insert into classes (grade, academic_year, school_id) values (4, '2025-2026', $1) returning id`,
        [OXFORD_SCHOOL_ID],
      );
      oxfordClassId = oc.rows[0].id;

      // Get subjects
      const sub = await h.db.query<{ id: string }>(`select id from subjects limit 1`);
      const subjectId = sub.rows[0].id;

      // Create materials in both schools
      const rm = await h.db.query<{ id: string }>(
        `insert into curriculum_materials
           (title, class_id, subject_id, chapter, academic_year, file_path, mime_type, byte_size, status, is_published, uploaded_by, school_id)
         values ('Royal English Guide', $1, $2, 'Ch1', '2025-2026', 'royal/ch1.pdf', 'application/pdf', 1024, 'ready', true, $3, $4)
         returning id`,
        [royalClassId, subjectId, royalPrincipalId, ROYAL_SCHOOL_ID],
      );
      royalMaterialId = rm.rows[0].id;

      const om = await h.db.query<{ id: string }>(
        `insert into curriculum_materials
           (title, class_id, subject_id, chapter, academic_year, file_path, mime_type, byte_size, status, is_published, uploaded_by, school_id)
         values ('Oxford Science Notes', $1, $2, 'Ch1', '2025-2026', 'oxford/ch1.pdf', 'application/pdf', 2048, 'ready', true, $3, $4)
         returning id`,
        [oxfordClassId, subjectId, oxfordPrincipalId, OXFORD_SCHOOL_ID],
      );
      oxfordMaterialId = om.rows[0].id;

      // Create requests in both schools
      const rr = await h.db.query<{ id: string }>(
        `insert into teacher_requests (school_id, teacher_id, type, status, title, details)
         values ($1, $2, 'leave', 'pending', 'Medical Leave', '{"reason": "Doctor appointment"}'::jsonb)
         returning id`,
        [ROYAL_SCHOOL_ID, royalTeacherId],
      );
      royalRequestId = rr.rows[0].id;

      const opr = await h.db.query<{ id: string }>(
        `insert into teacher_requests (school_id, teacher_id, type, status, title, details)
         values ($1, $2, 'leave', 'pending', 'Conference Leave', '{"reason": "Teaching conference"}'::jsonb)
         returning id`,
        [OXFORD_SCHOOL_ID, oxfordTeacherId],
      );
      oxfordRequestId = opr.rows[0].id;

      // Audit entries
      await h.db.query(
        `insert into audit_logs (school_id, actor_id, action, target, meta)
         values ($1, $2, 'school.init', 'royal', '{"event": "start"}'::jsonb)`,
        [ROYAL_SCHOOL_ID, royalPrincipalId],
      );
      await h.db.query(
        `insert into audit_logs (school_id, actor_id, action, target, meta)
         values ($1, $2, 'school.init', 'oxford', '{"event": "start"}'::jsonb)`,
        [OXFORD_SCHOOL_ID, oxfordPrincipalId],
      );
    });
  });

  // =========================================================================
  // 1. Cross-School Isolation Tests
  // =========================================================================
  it("Royal Principal CANNOT view Oxford teachers", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const { rows } = await h.db.query(
        `select * from profiles where id = $1`,
        [oxfordTeacherId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("Royal Principal CAN view Royal teachers", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const { rows } = await h.db.query<{ id: string }>(
        `select * from profiles where id = $1`,
        [royalTeacherId],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].id).toBe(royalTeacherId);
    });
  });

  it("Royal Teacher CANNOT view Oxford materials", async () => {
    await h.actAs(royalTeacherId, async () => {
      const { rows } = await h.db.query(
        `select * from curriculum_materials where id = $1`,
        [oxfordMaterialId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("Royal Principal CANNOT view Oxford curriculum materials", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const { rows } = await h.db.query(
        `select * from curriculum_materials where id = $1`,
        [oxfordMaterialId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("Royal Teacher Admin CANNOT view Oxford audit logs", async () => {
    await h.actAs(royalTeacherAdminId, async () => {
      const { rows } = await h.db.query(
        `select * from audit_logs where school_id = $1`,
        [OXFORD_SCHOOL_ID],
      );
      expect(rows).toHaveLength(0);
    });
  });

  it("Royal Teacher Admin CAN view Royal audit logs because they hold school.audit.view", async () => {
    await h.actAs(royalTeacherAdminId, async () => {
      const { rows } = await h.db.query(
        `select * from audit_logs where school_id = $1`,
        [ROYAL_SCHOOL_ID],
      );
      expect(rows.length).toBeGreaterThan(0);
    });
  });

  it("Oxford Principal CANNOT review or see Royal teacher requests", async () => {
    await h.actAs(oxfordPrincipalId, async () => {
      const { rows } = await h.db.query(
        `select * from teacher_requests where id = $1`,
        [royalRequestId],
      );
      expect(rows).toHaveLength(0);

      // Attempting to update a Royal request from Oxford principal must affect 0 rows
      const updateRes = await h.db.query(
        `update teacher_requests set status = 'approved' where id = $1`,
        [royalRequestId],
      );
      expect(updateRes.rowCount).toBe(0);
    });
  });

  it("Royal Principal CANNOT review or see Oxford teacher requests", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const { rows } = await h.db.query(
        `select * from teacher_requests where id = $1`,
        [oxfordRequestId],
      );
      expect(rows).toHaveLength(0);
    });
  });

  // =========================================================================
  // 2. Super Admin Cross-Tenant Authority Tests
  // =========================================================================
  it("Super Admin CAN view Royal School and Oxford School teachers", async () => {
    await h.actAs(superAdminId, async () => {
      const royalRows = await h.db.query(`select * from profiles where id = $1`, [royalTeacherId]);
      const oxfordRows = await h.db.query(`select * from profiles where id = $1`, [oxfordTeacherId]);
      expect(royalRows.rows).toHaveLength(1);
      expect(oxfordRows.rows).toHaveLength(1);
    });
  });

  it("Super Admin CAN view materials across all schools", async () => {
    await h.actAs(superAdminId, async () => {
      const { rows } = await h.db.query(`select * from curriculum_materials where id in ($1, $2)`, [
        royalMaterialId,
        oxfordMaterialId,
      ]);
      expect(rows).toHaveLength(2);
    });
  });

  it("Super Admin CAN view all audit logs globally", async () => {
    await h.actAs(superAdminId, async () => {
      const { rows } = await h.db.query(`select * from audit_logs`);
      expect(rows.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // 3. Privilege Escalation & IDOR Protection Tests
  // =========================================================================
  it("Teacher CANNOT promote themselves to Teacher Admin or Principal", async () => {
    await h.actAs(royalTeacherId, async () => {
      await expect(
        h.db.query(`update profiles set role = 'teacher_admin' where id = $1`, [royalTeacherId]),
      ).rejects.toThrow(/not authorized/);

      await expect(
        h.db.query(`update profiles set role = 'principal' where id = $1`, [royalTeacherId]),
      ).rejects.toThrow(/not authorized/);
    });
  });

  it("Royal Principal CANNOT promote themselves to super_admin", async () => {
    await h.actAs(royalPrincipalId, async () => {
      await expect(
        h.db.query(`update profiles set role = 'super_admin' where id = $1`, [royalPrincipalId]),
      ).rejects.toThrow();
    });
  });

  it("Royal Principal CANNOT modify an Oxford account (Tenant boundary in RLS)", async () => {
    await h.actAs(royalPrincipalId, async () => {
      const res = await h.db.query(
        `update profiles set status = 'suspended' where id = $1`,
        [oxfordTeacherId],
      );
      expect(res.rowCount).toBe(0);
    });
  });

  it("Teacher CANNOT forge request to another school (IDOR check)", async () => {
    await h.actAs(royalTeacherId, async () => {
      // Trying to inject a request into Oxford school
      await expect(
        h.db.query(
          `insert into teacher_requests (school_id, teacher_id, type, title)
           values ($1, $2, 'leave', 'Forged Request')`,
          [OXFORD_SCHOOL_ID, royalTeacherId],
        ),
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // 4. Teacher Admin Lifecycle & Request Flow Tests
  // =========================================================================
  it("Teacher can submit a Teacher Admin request to their Principal", async () => {
    let reqId = "";
    await h.actAs(royalTeacherId, async () => {
      const { rows } = await h.db.query<{ id: string }>(
        `insert into teacher_requests (school_id, teacher_id, type, status, title, details)
         values ($1, $2, 'teacher_admin', 'pending', 'Request for Teacher Admin', '{"reason": "Manage grade 2 materials"}'::jsonb)
         returning id`,
        [ROYAL_SCHOOL_ID, royalTeacherId],
      );
      reqId = rows[0].id;
      expect(reqId).toBeTruthy();
    });

    // Principal reviews and approves the request
    await h.actAs(royalPrincipalId, async () => {
      const res = await h.db.query(
        `update teacher_requests
         set status = 'approved', reviewed_by = $1, reviewed_at = now(), review_notes = 'Approved for Q3'
         where id = $2`,
        [royalPrincipalId, reqId],
      );
      expect(res.rowCount).toBe(1);

      // Principal assigns role and permission
      await h.db.query(
        `update profiles set role = 'teacher_admin' where id = $1`,
        [royalTeacherId],
      );

      await h.db.query(
        `insert into teacher_admin_permissions (school_id, teacher_id, permission_code, granted_by)
         values ($1, $2, 'school.material.upload', $3)`,
        [ROYAL_SCHOOL_ID, royalTeacherId, royalPrincipalId],
      );
    });

    // Verify teacher now has teacher_admin role
    await h.asService(async () => {
      const { rows } = await h.db.query<{ role: string }>(
        `select role from profiles where id = $1`,
        [royalTeacherId],
      );
      expect(rows[0].role).toBe("teacher_admin");
    });
  });

  // =========================================================================
  // 5. Biometric Authentication RBAC & Identity Verification Tests
  // =========================================================================
  it("Biometric verification establishes identity without bypassing RBAC", async () => {
    // Teacher registers biometric template hash with consent
    await h.actAs(royalTeacherId, async () => {
      const templateHash = "sha256_e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const { rows } = await h.db.query(
        `insert into biometric_credentials (school_id, user_id, template_hash, consent_given)
         values ($1, $2, $3, true)
         returning id`,
        [ROYAL_SCHOOL_ID, royalTeacherId, templateHash],
      );
      expect(rows).toHaveLength(1);
    });

    // A biometric record exists, but user's role is STILL teacher_admin, NOT principal or super_admin
    await h.actAs(royalTeacherId, async () => {
      const { rows } = await h.db.query<{ role: string }>(
        `select role from profiles where id = auth.uid()`,
      );
      expect(rows[0].role).toBe("teacher_admin");
      // Face verification CANNOT access Oxford school data
      const oxfordCheck = await h.db.query(
        `select * from curriculum_materials where school_id = $1`,
        [OXFORD_SCHOOL_ID],
      );
      expect(oxfordCheck.rows).toHaveLength(0);
    });
  });
});
