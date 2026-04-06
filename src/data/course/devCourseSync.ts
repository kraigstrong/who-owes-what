import type { NormalizedCourse } from '@/domain/course';

export interface DevCourseFetchResult {
  query: string;
  rawResponse: unknown;
  normalizedCourses: NormalizedCourse[];
  savedOverlayPath: string;
  savedRawPath: string;
  warnings?: string[];
}

export interface DevCourseRemoveResult {
  removedCourseId: string;
  savedOverlayPath: string;
  remainingCourses: number;
}

export interface DevManagedCoursesResult {
  courses: NormalizedCourse[];
}

function getDevCourseServerUrl() {
  return 'http://127.0.0.1:8787';
}

async function devServerRequest<T>(path: string, body: object): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getDevCourseServerUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(
      'Unable to reach the local dev sync server. Start `npm run course-cache-server` and try again.',
    );
  }

  if (!response.ok) {
    let message = `Dev course server returned ${response.status}.`;

    try {
      const payload = (await response.json()) as { error?: string; savedRawPath?: string };
      if (payload.error) {
        message = payload.savedRawPath
          ? `${payload.error} Raw response saved to ${payload.savedRawPath}.`
          : payload.error;
      }
    } catch {
      const text = await response.text();
      if (text.trim()) {
        message = text;
      }
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export async function fetchCoursesIntoManagedOverlay(
  query: string,
): Promise<DevCourseFetchResult> {
  return devServerRequest<DevCourseFetchResult>('/courses/fetch', { query });
}

export async function removeCourseFromManagedOverlay(
  courseId: string,
): Promise<DevCourseRemoveResult> {
  return devServerRequest<DevCourseRemoveResult>('/courses/remove', { courseId });
}

export async function loadManagedCoursesFromDevServer(): Promise<NormalizedCourse[]> {
  const result = await devServerRequest<DevManagedCoursesResult>('/courses/managed', {});
  return result.courses;
}
