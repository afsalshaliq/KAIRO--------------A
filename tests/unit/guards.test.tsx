import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import type { Profile } from "@/types/db";

// Control the auth state deterministically.
const mockState: {
  loading: boolean; session: unknown; profile: Profile | null;
} = { loading: false, session: null, profile: null };

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => mockState,
}));

import { RequireRole } from "@/app/guards";

function routerAt(path: string) {
  return createMemoryRouter(
    [
      { path: "/admin", element: <RequireRole role="admin"><div>ADMIN AREA</div></RequireRole> },
      { path: "/teacher", element: <RequireRole role="teacher"><div>TEACHER AREA</div></RequireRole> },
      { path: "/admin/login", element: <div>ADMIN LOGIN</div> },
      { path: "/teacher/login", element: <div>TEACHER LOGIN</div> },
      { path: "/admin/dashboard", element: <div>ADMIN DASH</div> },
      { path: "/teacher/dashboard", element: <div>TEACHER DASH</div> },
    ],
    { initialEntries: [path] },
  );
}

function profile(role: "admin" | "teacher"): Profile {
  return {
    id: "u", email: "u@x.co", full_name: "U", role, status: "active",
    school_id: "00000000-0000-0000-0000-000000000001",
    phone: "", address: "", avatar_url: "", degree: "",
    degree_certificate_url: "", department: "General", joining_date: "2024-01-01",
    created_at: "", updated_at: "",
  };
}

afterEach(() => {
  mockState.loading = false;
  mockState.session = null;
  mockState.profile = null;
});

describe("RequireRole route guard", () => {
  it("shows a spinner while auth is loading", () => {
    mockState.loading = true;
    render(<RouterProvider router={routerAt("/admin")} />);
    expect(screen.getByText(/checking your access/i)).toBeInTheDocument();
  });

  it("redirects an unauthenticated visitor to the matching portal login", () => {
    render(<RouterProvider router={routerAt("/admin")} />);
    expect(screen.getByText("ADMIN LOGIN")).toBeInTheDocument();

    render(<RouterProvider router={routerAt("/teacher")} />);
    expect(screen.getByText("TEACHER LOGIN")).toBeInTheDocument();
  });

  it("blocks a teacher from the admin area (redirects to their dashboard)", () => {
    mockState.session = {};
    mockState.profile = profile("teacher");
    render(<RouterProvider router={routerAt("/admin")} />);
    expect(screen.getByText("TEACHER DASH")).toBeInTheDocument();
    expect(screen.queryByText("ADMIN AREA")).not.toBeInTheDocument();
  });

  it("blocks an admin from the teacher area (redirects to their dashboard)", () => {
    mockState.session = {};
    mockState.profile = profile("admin");
    render(<RouterProvider router={routerAt("/teacher")} />);
    expect(screen.getByText("ADMIN DASH")).toBeInTheDocument();
    expect(screen.queryByText("TEACHER AREA")).not.toBeInTheDocument();
  });

  it("admits a matching role", () => {
    mockState.session = {};
    mockState.profile = profile("admin");
    render(<RouterProvider router={routerAt("/admin")} />);
    expect(screen.getByText("ADMIN AREA")).toBeInTheDocument();
  });
});
