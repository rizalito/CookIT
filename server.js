const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");
const { DatabaseSync } = require("node:sqlite");

const scrypt = promisify(crypto.scrypt);
const root = __dirname;
const dataDirectory = path.join(root, "data");
const databasePath = path.join(dataDirectory, "cookit.sqlite");
const port = Number(process.env.PORT || 4173);
const allowedRecipeIds = new Set([
  "pancakes",
  "adobo",
  "pasta",
  "salad",
  "omelet",
  "burger",
  "cookies",
  "fries",
]);

fs.mkdirSync(dataDirectory, { recursive: true });
const database = new DatabaseSync(databasePath);
database.exec(`
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    username TEXT NOT NULL COLLATE NOCASE UNIQUE,
    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS favorites (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipe_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, recipe_id)
  );
  CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
`);

const statements = {
  accountByIdentity: database.prepare(
    "SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
  ),
  accountByNameOrEmail: database.prepare(
    "SELECT id FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE",
  ),
  addUser: database.prepare(
    "INSERT INTO users (id, display_name, username, email, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ),
  userById: database.prepare(
    "SELECT id, display_name, username, email FROM users WHERE id = ?",
  ),
  addSession: database.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ),
  sessionUser: database.prepare(
    "SELECT users.id, users.display_name, users.username FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?",
  ),
  removeSession: database.prepare("DELETE FROM sessions WHERE token_hash = ?"),
  listFavorites: database.prepare(
    "SELECT recipe_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC",
  ),
  addFavorite: database.prepare(
    "INSERT OR IGNORE INTO favorites (user_id, recipe_id, created_at) VALUES (?, ?, ?)",
  ),
  removeFavorite: database.prepare(
    "DELETE FROM favorites WHERE user_id = ? AND recipe_id = ?",
  ),
};

function json(response, status, payload, extraHeaders = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  const cookies = {};
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    const rawVal = part.slice(separator + 1).trim();
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

function cookieOptions(maxAge = null) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  if (maxAge === 0) {
    return `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`;
  }
  return `Path=/; HttpOnly; SameSite=Lax${maxAge === null ? "" : `; Max-Age=${maxAge}`}${secure}`;
}

function sessionFor(request) {
  const token = parseCookies(request).cookit_session;
  if (!token) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const user = statements.sessionUser.get(tokenHash, Date.now());
  return user ? { tokenHash, user } : null;
}

function publicUser(user) {
  return { id: user.id, name: user.display_name, username: user.username };
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 65536) reject(new Error("Request body too large"));
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

async function derivePassword(password, salt) {
  return (
    await scrypt(password, salt, 64, {
      N: 32768,
      r: 8,
      p: 1,
      maxmem: 64 * 1024 * 1024,
    })
  ).toString("hex");
}

async function api(request, response, url) {
  database
    .prepare("DELETE FROM sessions WHERE expires_at <= ?")
    .run(Date.now());
  const method = request.method;
  const pathname = url.pathname;

  if (method === "POST" && pathname === "/api/register") {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
    const name = String(body.name || "").trim();
    const username = String(body.username || "").trim();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    if (
      name.length < 2 ||
      name.length > 80 ||
      !/^[a-zA-Z0-9_.-]{3,30}$/.test(username) ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      password.length < 8 ||
      password.length > 256
    ) {
      return json(response, 400, {
        error:
          "Enter a name, valid email, username (3–30 letters or numbers), and password (8–256 characters).",
      });
    }
    if (statements.accountByNameOrEmail.get(username, email)) {
      return json(response, 409, {
        error: "That username or email already has an account.",
      });
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = await derivePassword(
      password,
      Buffer.from(salt, "hex"),
    );
    const user = {
      id: crypto.randomUUID(),
      display_name: name,
      username,
      email,
    };
    try {
      statements.addUser.run(
        user.id,
        name,
        username,
        email,
        salt,
        passwordHash,
        Date.now(),
      );
    } catch (error) {
      if (
        error.code === "ERR_SQLITE_CONSTRAINT_UNIQUE" ||
        (error.code === "ERR_SQLITE_ERROR" &&
          /UNIQUE constraint failed/i.test(error.message))
      ) {
        return json(response, 409, {
          error: "That username or email already has an account.",
        });
      }
      throw error;
    }
    return json(response, 201, { user: publicUser(user) });
  }

  if (method === "POST" && pathname === "/api/login") {
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
    const identity = String(body.identity || "").trim();
    const password = String(body.password || "");
    const account = statements.accountByIdentity.get(identity, identity);
    if (!account || !password || password.length > 256)
      return json(response, 401, {
        error: "Incorrect username/email or password.",
      });
    const suppliedHash = Buffer.from(
      await derivePassword(password, Buffer.from(account.password_salt, "hex")),
      "hex",
    );
    const storedHash = Buffer.from(account.password_hash, "hex");
    if (
      suppliedHash.length !== storedHash.length ||
      !crypto.timingSafeEqual(suppliedHash, storedHash)
    ) {
      return json(response, 401, {
        error: "Incorrect username/email or password.",
      });
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const maxAge = body.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 12;
    statements.addSession.run(
      tokenHash,
      account.id,
      Date.now() + maxAge * 1000,
    );
    return json(
      response,
      200,
      { user: publicUser(account) },
      {
        "Set-Cookie": `cookit_session=${encodeURIComponent(token)}; ${cookieOptions(body.remember ? maxAge : null)}`,
      },
    );
  }

  if (method === "GET" && pathname === "/api/setup-status") {
    const result = database
      .prepare("SELECT EXISTS(SELECT 1 FROM users) AS has_accounts")
      .get();
    return json(response, 200, { hasAccounts: Boolean(result.has_accounts) });
  }

  const session = sessionFor(request);
  if (method === "POST" && pathname === "/api/logout") {
    if (session) statements.removeSession.run(session.tokenHash);
    return json(
      response,
      200,
      { ok: true },
      { "Set-Cookie": `cookit_session=; ${cookieOptions(0)}` },
    );
  }
  if (method === "GET" && pathname === "/api/me") {
    return session
      ? json(response, 200, { user: publicUser(session.user) })
      : json(response, 200, { user: null });
  }
  if (method === "GET" && pathname === "/api/favorites") {
    if (!session) return json(response, 401, { error: "Sign in required." });
    const favorites = statements.listFavorites
      .all(session.user.id)
      .map((row) => row.recipe_id);
    return json(response, 200, { favorites });
  }
  if (method === "PUT" && pathname === "/api/favorites") {
    if (!session) return json(response, 401, { error: "Sign in required." });
    let body;
    try {
      body = await readJson(request);
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
    if (!allowedRecipeIds.has(body.recipeId) || typeof body.saved !== "boolean")
      return json(response, 400, { error: "Invalid favorite request." });
    if (body.saved)
      statements.addFavorite.run(session.user.id, body.recipeId, Date.now());
    else statements.removeFavorite.run(session.user.id, body.recipeId);
    const favorites = statements.listFavorites
      .all(session.user.id)
      .map((row) => row.recipe_id);
    return json(response, 200, { favorites });
  }
  return json(response, 404, { error: "API route not found." });
}

function sendNotFound(response) {
  const notFoundPath = path.join(root, "404.html");
  fs.readFile(notFoundPath, (err, content) => {
    if (err) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(404, {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    });
    response.end(content);
  });
}

function sendFile(request, response, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Bad request");
    return;
  }
  let relativePath =
    decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
  let filePath = path.resolve(root, relativePath);
  let pathFromRoot = path.relative(root, filePath);
  if (
    pathFromRoot.startsWith("..") ||
    path.isAbsolute(pathFromRoot)
  ) {
    sendNotFound(response);
    return;
  }

  // Clean URLs: support /about, /recipes, etc. without explicit .html
  if (!path.extname(filePath)) {
    const htmlCandidate = filePath + ".html";
    if (fs.existsSync(htmlCandidate) && fs.statSync(htmlCandidate).isFile()) {
      filePath = htmlCandidate;
    }
  }

  if (!/\.(html|css|js|png|jpg|jpeg|webp|svg|ico)$/i.test(filePath)) {
    sendNotFound(response);
    return;
  }
  fs.stat(filePath, (error, stats) => {
    if (error || !stats.isFile()) {
      sendNotFound(response);
      return;
    }
    const types = {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };
    response.writeHead(200, {
      "Content-Type":
        types[path.extname(filePath).toLowerCase()] ||
        "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "SAMEORIGIN",
      "Referrer-Policy": "same-origin",
    });
    if (request.method === "HEAD") response.end();
    else fs.createReadStream(filePath).pipe(response);
  });
}

const server = http.createServer((request, response) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`,
  );
  if (url.pathname.startsWith("/api/")) {
    api(request, response, url).catch((error) => {
      console.error(error);
      if (!response.headersSent)
        json(response, 500, { error: "Internal server error." });
      else response.end();
    });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" }).end("Method not allowed");
    return;
  }
  sendFile(request, response, url.pathname);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`CookIT is running at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${databasePath}`);
});
