import type { NormalizedCourse, SelectedCourse } from '@/domain/course';
import { fixtureCourses } from '@/data/course/fixtures';

const overlayCourses = require('./managedCatalog.overlay.json') as NormalizedCourse[];

function mergeCoursesById(courses: NormalizedCourse[]): NormalizedCourse[] {
  const merged = new Map<string, NormalizedCourse>();

  for (const course of courses) {
    merged.set(course.id, course);
  }

  return Array.from(merged.values()).sort((left, right) =>
    `${left.clubName} ${left.courseName}`.localeCompare(
      `${right.clubName} ${right.courseName}`,
    ),
  );
}

export function getManagedCatalogCourses(): NormalizedCourse[] {
  return mergeCoursesById([...fixtureCourses, ...overlayCourses]);
}

export function refreshManagedSelectedCourse(
  courseSelection: SelectedCourse | undefined,
): SelectedCourse | undefined {
  if (!courseSelection) {
    return courseSelection;
  }

  const course = getManagedCatalogCourses().find((entry) => entry.id === courseSelection.courseId);

  if (!course) {
    return courseSelection;
  }

  return {
    ...courseSelection,
    providerId: course.providerId,
    clubName: course.clubName,
    courseName: course.courseName,
    city: course.city,
    state: course.state,
    country: course.country,
    tees: course.tees,
    cachedAt: course.updatedAt,
  };
}
