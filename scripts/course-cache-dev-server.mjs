import { createServer } from 'node:http';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const overlayPath = path.join(
  repoRoot,
  'src',
  'data',
  'course',
  'managedCatalog.overlay.json',
);
const fixturesPath = path.join(repoRoot, 'src', 'data', 'course', 'portlandMetroFixtures.ts');
const rawDirectory = path.join(repoRoot, 'dev', 'course-api-raw');
const port = 8787;

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  response.end(JSON.stringify(payload));
}

function sanitizeFileName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

async function loadEnvFile() {
  const envPath = path.join(repoRoot, '.env');
  const raw = await readFile(envPath, 'utf8');
  const values = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    values[key] = value;
  }

  return values;
}

function ensureString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Golf Course API response is missing ${field}.`);
  }

  return value;
}

function mapHoles(rawHoles) {
  if (!Array.isArray(rawHoles) || rawHoles.length === 0) {
    throw new Error('Golf Course API response is missing tee hole data.');
  }

  return rawHoles.map((hole, index) => ({
    holeNumber: index + 1,
    par: hole.par,
    yardage: hole.yardage,
    strokeIndex: hole.handicap,
  }));
}

function mapTee(rawTee, gender, courseId, index) {
  return {
    id: `${courseId}-${gender}-${rawTee.tee_name ?? index}`,
    name: ensureString(rawTee.tee_name, 'tee_name'),
    gender,
    rating: rawTee.course_rating,
    slope: rawTee.slope_rating,
    bogeyRating: rawTee.bogey_rating,
    totalYards: rawTee.total_yards,
    totalMeters: rawTee.total_meters,
    parTotal: rawTee.par_total,
    frontRating: rawTee.front_course_rating,
    frontSlope: rawTee.front_slope_rating,
    backRating: rawTee.back_course_rating,
    backSlope: rawTee.back_slope_rating,
    holes: mapHoles(rawTee.holes),
  };
}

function normalizeCourse(rawCourse) {
  const courseId = String(rawCourse.id ?? '');
  const clubName = ensureString(rawCourse.club_name, 'club_name');
  const courseName = ensureString(rawCourse.course_name, 'course_name');

  if (!courseId) {
    throw new Error('Golf Course API response is missing course id.');
  }

  const maleTees = (rawCourse.tees?.male ?? []).map((tee, index) =>
    mapTee(tee, 'male', courseId, index),
  );
  const femaleTees = (rawCourse.tees?.female ?? []).map((tee, index) =>
    mapTee(tee, 'female', courseId, index),
  );
  const tees = [...maleTees, ...femaleTees];

  if (tees.length === 0) {
    throw new Error('Golf Course API response is missing tee data.');
  }

  return {
    id: courseId,
    providerId: 'golf-course-api',
    clubName,
    courseName,
    city: rawCourse.location?.city,
    state: rawCourse.location?.state,
    country: rawCourse.location?.country,
    latitude: rawCourse.location?.latitude,
    longitude: rawCourse.location?.longitude,
    tees,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeCourses(rawResponse) {
  const normalizedCourses = [];
  const warnings = [];

  for (const rawCourse of rawResponse.courses ?? []) {
    try {
      normalizedCourses.push(normalizeCourse(rawCourse));
    } catch (error) {
      const courseLabel =
        rawCourse?.club_name || rawCourse?.course_name || `course ${String(rawCourse?.id ?? '').trim() || 'unknown'}`;
      warnings.push(
        `${courseLabel}: ${
          error instanceof Error ? error.message : 'Unknown normalization error.'
        }`,
      );
    }
  }

  return { normalizedCourses, warnings };
}

async function loadOverlayCourses() {
  try {
    const raw = await readFile(overlayPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function saveOverlayCourses(courses) {
  await writeFile(overlayPath, `${JSON.stringify(courses, null, 2)}\n`, 'utf8');
}

async function loadFixtureCourses() {
  try {
    const raw = await readFile(fixturesPath, 'utf8');
    const match = raw.match(/portlandMetroFixtureCourses:\s*NormalizedCourse\[\]\s*=\s*(\[[\s\S]*\]);/);

    if (!match?.[1]) {
      return [];
    }

    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

async function loadManagedCourses() {
  const [fixtureCourses, overlayCourses] = await Promise.all([
    loadFixtureCourses(),
    loadOverlayCourses(),
  ]);
  const merged = new Map();

  for (const course of [...fixtureCourses, ...overlayCourses]) {
    merged.set(course.id, course);
  }

  return Array.from(merged.values()).sort((left, right) =>
    `${left.clubName} ${left.courseName}`.localeCompare(
      `${right.clubName} ${right.courseName}`,
    ),
  );
}

async function fetchRawCourses(query, apiKey) {
  const response = await fetch(
    `https://api.golfcourseapi.com/v1/search?search_query=${encodeURIComponent(query)}`,
    {
      headers: {
        Authorization: `Key ${apiKey}`,
      },
    },
  );

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error || `Golf Course API returned status ${response.status}.`,
    );
  }

  return payload;
}

async function handleFetch(request, response) {
  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      request.on('data', (chunk) => {
        data += chunk;
      });
      request.on('end', () => resolve(data));
      request.on('error', reject);
    });
    const parsed = JSON.parse(body || '{}');
    const query = typeof parsed.query === 'string' ? parsed.query.trim() : '';

    if (!query) {
      sendJson(response, 400, { error: 'Missing query.' });
      return;
    }

    const env = await loadEnvFile();
    const apiKey = env.GOLF_COURSE_API_KEY?.trim();

    if (!apiKey) {
      sendJson(response, 500, { error: 'GOLF_COURSE_API_KEY is not configured.' });
      return;
    }

    const rawResponse = await fetchRawCourses(query, apiKey);
    await mkdir(rawDirectory, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rawFilePath = path.join(
      rawDirectory,
      `${sanitizeFileName(query) || 'course-query'}-${timestamp}.json`,
    );
    await writeFile(rawFilePath, `${JSON.stringify(rawResponse, null, 2)}\n`, 'utf8');

    const { normalizedCourses, warnings } = normalizeCourses(rawResponse);

    if (normalizedCourses.length === 0) {
      sendJson(response, 422, {
        error:
          warnings[0] ??
          `No courses could be normalized from the Golf Course API response for "${query}".`,
        warnings,
        savedRawPath: path.relative(repoRoot, rawFilePath),
      });
      return;
    }

    const existingOverlay = await loadOverlayCourses();
    const merged = new Map(existingOverlay.map((course) => [course.id, course]));

    for (const course of normalizedCourses) {
      merged.set(course.id, course);
    }

    const nextOverlayCourses = Array.from(merged.values()).sort((left, right) =>
      `${left.clubName} ${left.courseName}`.localeCompare(
        `${right.clubName} ${right.courseName}`,
      ),
    );

    await saveOverlayCourses(nextOverlayCourses);

    sendJson(response, 200, {
      query,
      rawResponse,
      normalizedCourses,
      savedOverlayPath: path.relative(repoRoot, overlayPath),
      savedRawPath: path.relative(repoRoot, rawFilePath),
      warnings,
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unknown dev server error.',
    });
  }
}

async function handleRemove(request, response) {
  try {
    const body = await new Promise((resolve, reject) => {
      let data = '';
      request.on('data', (chunk) => {
        data += chunk;
      });
      request.on('end', () => resolve(data));
      request.on('error', reject);
    });
    const parsed = JSON.parse(body || '{}');
    const courseId = typeof parsed.courseId === 'string' ? parsed.courseId.trim() : '';

    if (!courseId) {
      sendJson(response, 400, { error: 'Missing courseId.' });
      return;
    }

    const existingOverlay = await loadOverlayCourses();
    const nextOverlayCourses = existingOverlay.filter((course) => course.id !== courseId);

    if (nextOverlayCourses.length === existingOverlay.length) {
      sendJson(response, 404, { error: `Course ${courseId} was not found in the managed overlay.` });
      return;
    }

    await saveOverlayCourses(nextOverlayCourses);

    sendJson(response, 200, {
      removedCourseId: courseId,
      savedOverlayPath: path.relative(repoRoot, overlayPath),
      remainingCourses: nextOverlayCourses.length,
    });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Unknown dev server error.',
    });
  }
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.url === '/health') {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method === 'POST' && request.url === '/courses/fetch') {
    await handleFetch(request, response);
    return;
  }

  if (request.method === 'POST' && request.url === '/courses/remove') {
    await handleRemove(request, response);
    return;
  }

  if (request.method === 'POST' && request.url === '/courses/managed') {
    sendJson(response, 200, {
      courses: await loadManagedCourses(),
    });
    return;
  }

  sendJson(response, 404, { error: 'Not found.' });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Course cache dev server listening on http://127.0.0.1:${port}`);
});
