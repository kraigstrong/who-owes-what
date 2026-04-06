import { getManagedCatalogCourses } from '@/data/course/managedCatalog';
import type { NormalizedCourse } from '@/domain/course';

export interface CourseSearchResult {
  courses: NormalizedCourse[];
  source: 'catalog';
  status: 'ready';
}

function normalizeSearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function searchLocalCourses(
  courses: NormalizedCourse[],
  query: string,
): NormalizedCourse[] {
  const normalizedQuery = normalizeSearchText(query);

  if (!normalizedQuery) {
    return courses;
  }

  const queryTokens = normalizedQuery.split(' ');

  return courses.filter((course) => {
    const searchableText = normalizeSearchText(
      [
      course.clubName,
      course.courseName,
      course.city,
      course.state,
      course.country,
    ]
      .filter(Boolean)
      .join(' '),
    );

    return queryTokens.every((token) => searchableText.includes(token));
  });
}

export class CourseRepository {
  async getManagedCourses(): Promise<NormalizedCourse[]> {
    return getManagedCatalogCourses();
  }

  async searchCourses(query: string): Promise<CourseSearchResult> {
    const managedCourses = await this.getManagedCourses();

    return {
      courses: searchLocalCourses(managedCourses, query),
      source: 'catalog',
      status: 'ready',
    };
  }
}
