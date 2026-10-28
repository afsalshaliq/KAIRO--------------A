/**
 * Tenant Indicator Bar — DEPRECATED FOR GENERAL USERS
 *
 * In accordance with production multi-tenant design:
 * 1. The top tenant indicator bar has been removed from all normal school layouts
 *    (principals, teachers, students, parents).
 * 2. Authorized platform administrators (Super Admins) use the secure
 *    AdminTenantSwitcher located in the SuperAdmin console header.
 * 3. This component is preserved as a disabled stub to prevent any accidental imports.
 */

export { AdminTenantSwitcher } from "./AdminTenantSwitcher";

export function TenantBar() {
  // Disabled: normal users never see development bars or tenant switchers
  return null;
}
