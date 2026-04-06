import type { NormalizedCourse } from '@/domain/course';
import { portlandMetroFixtureCourses } from '@/data/course/portlandMetroFixtures';

export const fixtureCourses: NormalizedCourse[] = [
  ...portlandMetroFixtureCourses,
];
