import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { courseRepository } from '@/data/course';
import { searchLocalCourses } from '@/data/course/courseRepository';
import {
  fetchCoursesIntoManagedOverlay,
  loadManagedCoursesFromDevServer,
  removeCourseFromManagedOverlay,
} from '@/data/course/devCourseSync';
import { buildSelectedCourse, formatCourseDisplayName } from '@/domain/course';
import type { NormalizedCourse } from '@/domain/course';
import { useAppStore } from '@/state/useAppStore';

export function CoursePickerScreen() {
  const router = useRouter();
  const setSelectedCourseForDraft = useAppStore((state) => state.setSelectedCourseForDraft);
  const recentCourses = useAppStore((state) => state.recentCourses);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<NormalizedCourse[]>([]);
  const [statusMessage, setStatusMessage] = useState('');
  const [devRawResponse, setDevRawResponse] = useState<string | null>(null);

  const visibleCourses = useMemo(() => searchLocalCourses(courses, query), [courses, query]);
  const recentCourseIds = useMemo(
    () => new Set(recentCourses.map((course) => course.courseId)),
    [recentCourses],
  );
  const visibleRecentCourses = useMemo(
    () =>
      recentCourses.flatMap((recentCourse) => {
        const matchingCourse = courses.find((course) => course.id === recentCourse.courseId);

        if (!matchingCourse || searchLocalCourses([matchingCourse], query).length === 0) {
          return [];
        }

        return [matchingCourse];
      }),
    [courses, query, recentCourses],
  );
  const visibleCatalogCourses = useMemo(
    () => visibleCourses.filter((course) => !recentCourseIds.has(course.id)),
    [recentCourseIds, visibleCourses],
  );

  const loadManagedCourses = async () => {
    setLoading(true);
    setStatusMessage('');
    try {
      const result =
        __DEV__
          ? await loadManagedCoursesFromDevServer().catch(() =>
              courseRepository.getManagedCourses(),
            )
          : await courseRepository.getManagedCourses();
      setCourses(result);
    } finally {
      setLoading(false);
    }
  };

  const fetchFromApi = async () => {
    setLoading(true);
    setStatusMessage('');

    try {
      const result = await fetchCoursesIntoManagedOverlay(query);
      setDevRawResponse(JSON.stringify(result.rawResponse, null, 2));
      setCourses((currentCourses) => {
        const merged = new Map(currentCourses.map((course) => [course.id, course]));

        for (const course of result.normalizedCourses) {
          merged.set(course.id, course);
        }

        return Array.from(merged.values()).sort((left, right) =>
          `${left.clubName} ${left.courseName}`.localeCompare(
            `${right.clubName} ${right.courseName}`,
          ),
        );
      });
      setStatusMessage(
        `Saved ${result.normalizedCourses.length} course result(s) to ${result.savedOverlayPath}. Raw response saved to ${result.savedRawPath}.${result.warnings?.length ? ` ${result.warnings.length} course result(s) were skipped because the API payload was incomplete.` : ''} Reload to use the updated catalog everywhere.`,
      );
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : 'Unable to fetch from the development course server.',
      );
    } finally {
      setLoading(false);
    }
  };

  const removeCourse = (course: NormalizedCourse) => {
    Alert.alert(
      'Remove course',
      `Remove ${formatCourseDisplayName(course)} from the managed catalog?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setLoading(true);
              setStatusMessage('');

              try {
                const result = await removeCourseFromManagedOverlay(course.id);
                setCourses((currentCourses) =>
                  currentCourses.filter((entry) => entry.id !== course.id),
                );
                setStatusMessage(
                  `Removed ${formatCourseDisplayName(course)} from ${result.savedOverlayPath}. ${result.remainingCourses} course result(s) remain in the managed overlay.`,
                );
              } catch (error) {
                setStatusMessage(
                  error instanceof Error
                    ? error.message
                    : 'Unable to remove the course from the managed overlay.',
                );
              } finally {
                setLoading(false);
              }
            })();
          },
        },
      ],
    );
  };

  useEffect(() => {
    void loadManagedCourses();
  }, []);

  return (
    <Screen>
      <ScreenHeader
        title="Choose course"
        subtitle="Search the managed course catalog."
        showBackButton
      />

      <Card>
        <TextInput
          style={styles.input}
          placeholder="Search course or club"
          placeholderTextColor="#8c7f65"
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.row}>
          <Button
            label="Search"
            variant="secondary"
            onPress={() => void loadManagedCourses()}
          />
          {__DEV__ ? (
            <Button label="Fetch from API" onPress={() => void fetchFromApi()} />
          ) : null}
        </View>
        <Text style={styles.helperText}>
          Default search only uses the managed course catalog.
        </Text>
      </Card>

      {statusMessage ? (
        <Card>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </Card>
      ) : null}

      {loading ? (
        <Card>
          <ActivityIndicator color="#0d5d56" />
        </Card>
      ) : null}

      {visibleRecentCourses.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently played</Text>
          {visibleRecentCourses.map((course) => (
            <Card key={`recent-${course.id}`}>
              <Text style={styles.courseName}>
                {formatCourseDisplayName(course)}
              </Text>
              <Text style={styles.helperText}>
                {[course.city, course.state].filter(Boolean).join(', ') || 'No location'}
                {`  •  ${course.tees.length} tees`}
              </Text>
              <Button
                label="Use course"
                variant="secondary"
                onPress={() => {
                  setSelectedCourseForDraft(buildSelectedCourse(course));
                  router.back();
                }}
              />
              {__DEV__ ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={() => removeCourse(course)}
                />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {visibleCatalogCourses.length > 0 ? (
        <View style={styles.section}>
          {visibleRecentCourses.length > 0 ? (
            <Text style={styles.sectionTitle}>All courses</Text>
          ) : null}
          {visibleCatalogCourses.map((course) => (
            <Card key={course.id}>
              <Text style={styles.courseName}>
                {formatCourseDisplayName(course)}
              </Text>
              <Text style={styles.helperText}>
                {[course.city, course.state].filter(Boolean).join(', ') || 'No location'}
                {`  •  ${course.tees.length} tees`}
              </Text>
              <Button
                label="Use course"
                variant="secondary"
                onPress={() => {
                  setSelectedCourseForDraft(buildSelectedCourse(course));
                  router.back();
                }}
              />
              {__DEV__ ? (
                <Button
                  label="Remove"
                  variant="ghost"
                  onPress={() => removeCourse(course)}
                />
              ) : null}
            </Card>
          ))}
        </View>
      ) : null}

      {__DEV__ && devRawResponse ? (
        <Card>
          <Text style={styles.sectionTitle}>Raw API response</Text>
          <ScrollView horizontal style={styles.rawResponseScroll}>
            <Text style={styles.rawResponseText}>{devRawResponse}</Text>
          </ScrollView>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#17352b',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d4c3a4',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fffdf8',
    color: '#17352b',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  helperText: {
    color: '#655945',
    lineHeight: 20,
  },
  statusText: {
    color: '#7d3126',
    fontWeight: '600',
    lineHeight: 20,
  },
  courseName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17352b',
  },
  rawResponseScroll: {
    maxHeight: 320,
  },
  rawResponseText: {
    color: '#17352b',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: 'Courier',
  },
});
