import { CourseRepository, searchLocalCourses } from '@/data/course/courseRepository';
import type { NormalizedCourse } from '@/domain/course';

const sampleCourses: NormalizedCourse[] = [
  {
    id: 'course-1',
    providerId: 'golf-course-api',
    clubName: 'Chehalem Glenn Golf Course',
    courseName: 'Chehalem Glenn Golf Course',
    city: 'Newberg',
    state: 'OR',
    country: 'United States',
    tees: [],
    updatedAt: '2026-04-06T00:00:00.000Z',
  },
  {
    id: 'course-2',
    providerId: 'golf-course-api',
    clubName: 'Heron Lakes Golf Club',
    courseName: 'Great Blue Course',
    city: 'Portland',
    state: 'OR',
    country: 'United States',
    tees: [],
    updatedAt: '2026-04-06T00:00:00.000Z',
  },
  {
    id: 'course-3',
    providerId: 'golf-course-api',
    clubName: 'The Reserve Vineyards',
    courseName: 'North Course',
    city: 'Aloha',
    state: 'OR',
    country: 'United States',
    tees: [],
    updatedAt: '2026-04-06T00:00:00.000Z',
  },
];

describe('CourseRepository', () => {
  it('returns the managed catalog as an array of normalized courses', async () => {
    const repository = new CourseRepository();

    const courses = await repository.getManagedCourses();

    expect(Array.isArray(courses)).toBe(true);
    expect(
      courses.every(
        (course) =>
          typeof course.id === 'string' &&
          typeof course.clubName === 'string' &&
          typeof course.courseName === 'string' &&
          Array.isArray(course.tees),
      ),
    ).toBe(true);
  });

  it('searches the managed catalog without touching app-local cache state', async () => {
    const repository = new CourseRepository();
    const catalog = await repository.getManagedCourses();
    const query = catalog[0]?.clubName?.split(' ')[0] ?? 'Wildwood';

    const result = await repository.searchCourses(query);

    expect(result.source).toBe('catalog');
    expect(result.status).toBe('ready');
    expect(Array.isArray(result.courses)).toBe(true);
  });
});

describe('searchLocalCourses', () => {
  it('returns every course when the query is blank', () => {
    expect(searchLocalCourses(sampleCourses, '')).toHaveLength(sampleCourses.length);
  });

  it('matches on club, course, and location fields', () => {
    const matches = searchLocalCourses(sampleCourses, 'Portland');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.clubName).toBe('Heron Lakes Golf Club');
  });

  it('matches multi-word queries across club and course names', () => {
    const matches = searchLocalCourses(sampleCourses, 'reserve north');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.clubName).toBe('The Reserve Vineyards');
  });
});
