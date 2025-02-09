const request = require("supertest");
const app = require("../server"); 
let token; 

describe("User Registration and Login (Test Setup)", () => {
  const testEmail = "testuser@example.com";
  const testPassword = "secret123";

  beforeAll(async () => {

    try {
      const registerRes = await request(app)
        .post("/auth/register") 
        .send({ email: testEmail, password: testPassword });

        console-log("REGISTERRRRRRR", registerRes.body)

      if (registerRes.statusCode === 201) {
        console.log("Test user registered:", testEmail);
      } else if (registerRes.statusCode === 409) {
        console.log("Test user already exists, continuing...");
      } else {
        console.warn("Unexpected response for registration:", registerRes.body);
      }
    } catch (err) {
      console.error("Error while trying to register test user:", err.message);
    }

    // Now log in
    const loginRes = await request(app)
      .post("/auth/login") 
      .send({ email: testEmail, password: testPassword });

    if (loginRes.statusCode === 200 && loginRes.body.token) {
      token = loginRes.body.token;
      console.log("Test user logged in, token acquired.");
    } else {
      throw new Error(
        `Failed to log in test user. Status: ${loginRes.statusCode}, Body: ${JSON.stringify(loginRes.body)}`
      );
    }
  });

  it("should have a valid token for test user", () => {
    expect(token).toBeDefined();
  });


  it("should access a protected route with this token", async () => {
    const res = await request(app)
      .get("/collections/owned")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
  });
  it("should create a new collection", async () => {
    const res = await request(app)
      .post("/collections")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Test Collection", description: "Some test" });

    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe("Test Collection");
  });

  it("should list owned collections", async () => {
    const res = await request(app)
      .get("/collections/owned")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("should return 404 for non-existing collection", async () => {
    const res = await request(app)
      .get("/collections/99999999")
      .set("Authorization", `Bearer ${token}`);
    expect(res.statusCode).toBe(404);
  });
});