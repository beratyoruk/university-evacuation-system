import request from "supertest";
import bcrypt from "bcrypt";

// Mock the database module. Each test can tweak the behavior of `query`.
const mockQuery = jest.fn();
jest.mock("../db/db", () => ({
  __esModule: true,
  query: (...args: unknown[]) => mockQuery(...args),
  pool: { connect: jest.fn() },
  getClient: jest.fn(),
  transaction: jest.fn(),
}));

import authRoutes from "../routes/auth.routes";
import { buildTestApp } from "./testApp";

const app = buildTestApp([{ prefix: "auth", router: authRoutes }]);

beforeEach(() => {
  mockQuery.mockReset();
});

describe("POST /api/auth/register", () => {
  it("creates a new user and returns a token", async () => {
    // 1st call: duplicate check (returns empty)
    // 2nd call: INSERT returning the new user row
    mockQuery
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "user-1",
            email: "new@edu.tr",
            role: "user",
            university_id: null,
            created_at: new Date().toISOString(),
          },
        ],
        rowCount: 1,
      });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "new@edu.tr", password: "strongpass123" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.email).toBe("new@edu.tr");
  });

  it("rejects registration when email already exists", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "existing" }], rowCount: 1 });

    const res = await request(app)
      .post("/api/auth/register")
      .send({ email: "dup@edu.tr", password: "strongpass123" });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it("rejects missing/invalid payload (zod validation)", async () => {
    const res = await request(app).post("/api/auth/register").send({ email: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

describe("POST /api/auth/login", () => {
  it("returns a token for valid credentials", async () => {
    const passwordHash = await bcrypt.hash("correct-horse-battery", 4);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "valid@edu.tr",
          password_hash: passwordHash,
          role: "admin",
          university_id: null,
          created_at: new Date().toISOString(),
        },
      ],
      rowCount: 1,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "valid@edu.tr", password: "correct-horse-battery" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.user.role).toBe("admin");
  });

  it("returns 401 for wrong password", async () => {
    const passwordHash = await bcrypt.hash("correct-password", 4);
    mockQuery.mockResolvedValueOnce({
      rows: [
        {
          id: "user-1",
          email: "valid@edu.tr",
          password_hash: passwordHash,
          role: "user",
          university_id: null,
          created_at: new Date().toISOString(),
        },
      ],
      rowCount: 1,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "valid@edu.tr", password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("returns 401 for unknown email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@edu.tr", password: "any-password-123" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when body is malformed", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "x@x.com" });
    expect(res.status).toBe(400);
  });
});
