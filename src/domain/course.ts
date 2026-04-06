export type CourseProviderId = 'golf-course-api' | 'fixture';

export interface CourseHole {
  holeNumber: number;
  par?: number;
  yardage?: number;
  strokeIndex?: number;
}

export interface TeeOption {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'unknown';
  totalYards?: number;
  totalMeters?: number;
  parTotal?: number;
  rating?: number;
  slope?: number;
  bogeyRating?: number;
  frontRating?: number;
  frontSlope?: number;
  backRating?: number;
  backSlope?: number;
  holes: CourseHole[];
}

export interface NormalizedCourse {
  id: string;
  providerId: CourseProviderId;
  clubName: string;
  courseName: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  tees: TeeOption[];
  updatedAt: string;
}

export interface SelectedCourse {
  courseId: string;
  providerId: CourseProviderId;
  clubName: string;
  courseName: string;
  city?: string;
  state?: string;
  country?: string;
  tees: TeeOption[];
  cachedAt: string;
}

function normalizeCourseTitlePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatCourseDisplayName(course: {
  clubName: string;
  courseName: string;
}): string {
  const clubName = course.clubName.trim();
  const courseName = course.courseName.trim();

  if (!clubName) {
    return courseName;
  }

  if (!courseName) {
    return clubName;
  }

  if (normalizeCourseTitlePart(clubName) === normalizeCourseTitlePart(courseName)) {
    return clubName.length >= courseName.length ? clubName : courseName;
  }

  return `${clubName} / ${courseName}`;
}

export function getTeeGenderLabel(gender: TeeOption['gender']): string {
  if (gender === 'male') {
    return 'Men';
  }

  if (gender === 'female') {
    return 'Women';
  }

  return 'Open';
}

export function formatTeeDisplayName(
  teeName: string,
  teeGender: TeeOption['gender'],
): string {
  if (teeGender === 'unknown') {
    return teeName;
  }

  return `${teeName} • ${getTeeGenderLabel(teeGender)}`;
}

export function buildSelectedCourse(
  course: NormalizedCourse,
): SelectedCourse {
  return {
    courseId: course.id,
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

export function findTeeById(
  course: SelectedCourse | undefined,
  teeId: string | undefined,
): TeeOption | undefined {
  if (!course || !teeId) {
    return undefined;
  }

  return course.tees.find((tee) => tee.id === teeId);
}

function getDefaultTeeCandidates(course: SelectedCourse): TeeOption[] {
  const preferredGenders = course.tees.filter((tee) => tee.gender !== 'female');

  return preferredGenders.length > 0 ? preferredGenders : course.tees;
}

function getPreferredTeeNameScore(name: string): number {
  const normalized = name.trim().toLowerCase();

  if (normalized.includes('white')) {
    return 0;
  }

  if (normalized.includes('tan')) {
    return 1;
  }

  if (normalized.includes('silver')) {
    return 2;
  }

  if (normalized.includes('gold')) {
    return 3;
  }

  return Number.POSITIVE_INFINITY;
}

export function selectDefaultTee(course: SelectedCourse): TeeOption | undefined {
  const candidates = getDefaultTeeCandidates(course);

  if (candidates.length === 0) {
    return undefined;
  }

  const namedPreference = candidates
    .map((tee) => ({
      tee,
      score: getPreferredTeeNameScore(tee.name),
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => left.score - right.score || (right.tee.totalYards ?? 0) - (left.tee.totalYards ?? 0))[0]?.tee;

  if (namedPreference) {
    return namedPreference;
  }

  const sortedByYardage = [...candidates].sort(
    (left, right) => (right.totalYards ?? 0) - (left.totalYards ?? 0),
  );

  return sortedByYardage[Math.floor(sortedByYardage.length / 2)] ?? sortedByYardage[0];
}
