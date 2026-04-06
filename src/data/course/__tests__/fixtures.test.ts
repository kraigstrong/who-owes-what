import { refreshManagedSelectedCourse } from '@/data/course/managedCatalog';
import { buildSelectedCourse, type NormalizedCourse } from '@/domain/course';

describe('refreshManagedSelectedCourse', () => {
  it('returns the original selection when the course is not in the managed catalog', () => {
    const course: NormalizedCourse = {
      id: 'missing-course',
      providerId: 'golf-course-api',
      clubName: 'Missing Club',
      courseName: 'Missing Course',
      city: 'Portland',
      state: 'OR',
      country: 'United States',
      tees: [],
      updatedAt: '2026-04-06T00:00:00.000Z',
    };

    const selection = buildSelectedCourse(course);
    const refreshed = refreshManagedSelectedCourse(selection);

    expect(refreshed).toEqual(selection);
  });
});
