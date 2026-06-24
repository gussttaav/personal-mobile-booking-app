import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SkeletonBlock } from '@/components/SkeletonBlock';
import { Colors, FontFamily, Radius, Spacing, TypeScale } from '@/constants/theme';
import { api } from '@/lib/api-client';
import {
  buildGridModel,
  civilDateInTz,
  civilWeekday,
  dateKey,
  getDeviceTimeZone,
  weekColumns,
  type CivilDate,
  type GridCell as GridCellModel,
  type GridModel,
} from '@/lib/grid-time';
import type { AvailabilitySlot, GetScheduleResponse } from '@/types/api';

// ── Grid geometry ───────────────────────────────────────────────────────────
// Cells stay ~60px wide for comfortable touch (resolved design decision).

const HOURS_COL_W = 48;
const HEADER_H = 54;
const CELL_W = 60;
const CELL_H = 54;
const COL_GAP = 5;
const ROW_GAP = 5;
const LOADING_ROWS = 6;

// ── Cell-state colors (web continuity; mapped onto theme where present) ───────

const CELL_COLORS = {
  available: { bg: Colors.successBg, border: Colors.successBorder, text: '#7ff0c2' },
  booked: { bg: 'rgba(255, 128, 120, 0.10)', border: 'rgba(255, 128, 120, 0.24)', text: '#ffb3af' },
  unavailable: { bg: 'rgba(255, 255, 255, 0.02)', border: Colors.border, text: '#54545a' },
  noFit2h: { bg: 'rgba(78, 222, 163, 0.045)', border: 'rgba(78, 222, 163, 0.32)', text: '#8a9990' },
} as const;

// ── Spanish date labels ───────────────────────────────────────────────────────

const WEEKDAYS_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const MONTHS_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_FULL_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function parseKey(key: string): CivilDate {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

function weekRangeLabel(cols: CivilDate[]): string {
  const a = cols[0];
  const b = cols[cols.length - 1];
  if (a.month === b.month) return `${a.day} – ${b.day} ${MONTHS_SHORT_ES[a.month - 1]}`;
  return `${a.day} ${MONTHS_SHORT_ES[a.month - 1]} – ${b.day} ${MONTHS_SHORT_ES[b.month - 1]}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Duration = '1h' | '2h';
type ScreenState = 'loading' | 'ready' | 'error';
type Selection = { key: string; hour: number; slot: AvailabilitySlot };

// ── Top glow ──────────────────────────────────────────────────────────────────

function TopGlow() {
  return (
    <LinearGradient
      colors={['rgba(78, 222, 163, 0.16)', 'rgba(19, 19, 21, 0)']}
      style={styles.topGlow}
      pointerEvents="none"
    />
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header() {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.back()}
        activeOpacity={0.7}
        accessibilityLabel="Volver"
      >
        <MaterialCommunityIcons name="chevron-left" size={24} color={Colors.text} />
      </TouchableOpacity>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>Reservar</Text>
        <Text style={styles.headerSubtitle}>Paso 2 de 3 · elige fecha y hora</Text>
      </View>
    </View>
  );
}

// ── Duration toggle (reflects + switches the route param) ─────────────────────

function DurationToggle({ duration, onChange }: { duration: Duration; onChange: (d: Duration) => void }) {
  return (
    <View style={styles.toggle}>
      {(['1h', '2h'] as const).map((d) => {
        const active = duration === d;
        return (
          <TouchableOpacity
            key={d}
            style={[styles.toggleSeg, active && styles.toggleSegActive]}
            onPress={() => onChange(d)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, active && styles.toggleTextActive]}>
              {d === '1h' ? '1 hora' : '2 horas'}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Week navigation ───────────────────────────────────────────────────────────

function WeekNav({
  cols,
  timezone,
  loading,
  canPrev,
  canNext,
  onPrev,
  onNext,
}: {
  cols: CivilDate[];
  timezone: string;
  loading: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const mid = cols[3] ?? cols[0];
  return (
    <View style={styles.weekNav}>
      <View style={styles.weekNavLabel}>
        <Text style={styles.weekRange}>{weekRangeLabel(cols)}</Text>
        <Text style={styles.weekMeta} numberOfLines={1}>
          {MONTHS_FULL_ES[mid.month - 1]} {mid.year} · {timezone}
        </Text>
      </View>
      {loading && <ActivityIndicator size="small" color={Colors.primary} style={styles.weekSpinner} />}
      <View style={styles.weekNavBtns}>
        <TouchableOpacity
          style={[styles.navBtn, !canPrev && styles.navBtnDisabled]}
          onPress={onPrev}
          disabled={!canPrev}
          activeOpacity={0.8}
          accessibilityLabel="Semana anterior"
        >
          <MaterialCommunityIcons name="chevron-left" size={20} color={canPrev ? Colors.primary : Colors.textDim} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navBtn, !canNext && styles.navBtnDisabled]}
          onPress={onNext}
          disabled={!canNext}
          activeOpacity={0.8}
          accessibilityLabel="Semana siguiente"
        >
          <MaterialCommunityIcons name="chevron-right" size={20} color={canNext ? Colors.primary : Colors.textDim} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Grid cell ─────────────────────────────────────────────────────────────────

function GridCell({
  cell,
  selected,
  onPress,
}: {
  cell: GridCellModel;
  selected: boolean;
  onPress: () => void;
}) {
  if (selected) {
    return (
      <Pressable onPress={onPress} style={[styles.cell, styles.cellSelected]}>
        <Text style={styles.cellTextSelected}>{hourLabel(cell.hour)}</Text>
      </Pressable>
    );
  }

  switch (cell.state) {
    case 'available':
      return (
        <Pressable
          onPress={onPress}
          style={[styles.cell, { backgroundColor: CELL_COLORS.available.bg, borderColor: CELL_COLORS.available.border }]}
        >
          <Text style={[styles.cellText, { color: CELL_COLORS.available.text }]}>{hourLabel(cell.hour)}</Text>
        </Pressable>
      );
    case 'no-fit-2h':
      return (
        <View
          style={[
            styles.cell,
            {
              backgroundColor: CELL_COLORS.noFit2h.bg,
              borderColor: CELL_COLORS.noFit2h.border,
              borderStyle: 'dashed',
            },
          ]}
        >
          <Text style={[styles.cellText, { color: CELL_COLORS.noFit2h.text }]}>{hourLabel(cell.hour)}</Text>
          <Text style={styles.noFitBadge}>1 h</Text>
        </View>
      );
    case 'booked':
      return (
        <View style={[styles.cell, { backgroundColor: CELL_COLORS.booked.bg, borderColor: CELL_COLORS.booked.border }]}>
          <MaterialCommunityIcons name="lock" size={13} color={CELL_COLORS.booked.text} />
        </View>
      );
    case 'unavailable':
    default:
      return (
        <View
          style={[styles.cell, { backgroundColor: CELL_COLORS.unavailable.bg, borderColor: CELL_COLORS.unavailable.border }]}
        />
      );
  }
}

// ── The grid ──────────────────────────────────────────────────────────────────
// Frozen hours column (left) + a single horizontal ScrollView that holds BOTH the
// days header and the cells, so they scroll sideways together and stay aligned
// with no manual sync. The whole grid sits inside the screen's vertical page
// scroll (see ScheduleScreen), which provides vertical scrolling — so there is no
// nested perpendicular ScrollView with an ambiguous height, and the last row is
// always reachable. The horizontal scroll is given an explicit height so the page
// can measure it.

function Grid({
  model,
  today,
  selected,
  onSelect,
}: {
  model: GridModel;
  today: CivilDate;
  selected: Selection | null;
  onSelect: (s: Selection) => void;
}) {
  const todayKey = dateKey(today);
  const rows = model.hourRows.length;
  const rowsHeight = ROW_GAP + rows * (CELL_H + ROW_GAP);
  const scrollHeight = HEADER_H + rowsHeight;

  return (
    <View style={styles.gridCard}>
      <View style={styles.gridRow}>
        {/* Frozen hours column: corner + hour labels */}
        <View style={styles.hoursColumn}>
          <View style={styles.corner}>
            <MaterialCommunityIcons name="clock-outline" size={15} color={Colors.textDim} />
          </View>
          <View style={styles.hoursList}>
            {model.hourRows.map((h) => (
              <View key={h} style={styles.hourLabelCell}>
                <Text style={styles.hourLabel}>{hourLabel(h)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Days header + cells share one horizontal scroll → always aligned */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          style={{ height: scrollHeight }}
        >
          <View>
            <View style={styles.daysRow}>
              {model.columns.map((col) => {
                const isToday = col.key === todayKey;
                return (
                  <View key={col.key} style={styles.dayHead}>
                    <Text style={[styles.dayName, isToday && styles.dayTodayAccent]}>{WEEKDAYS_ES[col.weekday]}</Text>
                    <Text style={[styles.dayNum, isToday && styles.dayTodayAccent]}>{col.date.day}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.cellsRow}>
              {model.columns.map((col) => (
                <View key={col.key} style={styles.bodyColumn}>
                  {col.cells.map((cell) => (
                    <GridCell
                      key={cell.hour}
                      cell={cell}
                      selected={selected?.key === col.key && selected?.hour === cell.hour}
                      onPress={() => {
                        if (cell.state === 'available' && cell.slot) {
                          onSelect({ key: col.key, hour: cell.hour, slot: cell.slot });
                        }
                      }}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────

const LEGEND: { label: string; swatch: 'available' | 'noFit2h' | 'booked' | 'unavailable' }[] = [
  { label: 'Disponible', swatch: 'available' },
  { label: 'No válido', swatch: 'noFit2h' },
  { label: 'Reservado', swatch: 'booked' },
  { label: 'No disponible', swatch: 'unavailable' },
];

function Legend() {
  return (
    <View style={styles.legend}>
      {LEGEND.map((item) => {
        let swatchStyle;
        if (item.swatch === 'available') {
          swatchStyle = { backgroundColor: CELL_COLORS.available.bg, borderColor: CELL_COLORS.available.border };
        } else if (item.swatch === 'noFit2h') {
          swatchStyle = {
            backgroundColor: CELL_COLORS.noFit2h.bg,
            borderColor: CELL_COLORS.noFit2h.border,
            borderStyle: 'dashed' as const,
          };
        } else if (item.swatch === 'booked') {
          swatchStyle = { backgroundColor: CELL_COLORS.booked.bg, borderColor: CELL_COLORS.booked.border };
        } else {
          swatchStyle = { backgroundColor: CELL_COLORS.unavailable.bg, borderColor: CELL_COLORS.unavailable.border };
        }
        return (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendSwatch, swatchStyle]} />
            <Text style={styles.legendText}>{item.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ── Empty / loading / error blocks ────────────────────────────────────────────

function EmptyState({
  duration,
  minNoticeHours,
  canNext,
  onNextWeek,
  onSwitch1h,
}: {
  duration: Duration;
  minNoticeHours: number;
  canNext: boolean;
  onNextWeek: () => void;
  onSwitch1h: () => void;
}) {
  return (
    <View style={styles.emptyCard}>
      <View style={styles.emptyIcon}>
        <MaterialCommunityIcons name="calendar-search" size={26} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No quedan huecos esta semana</Text>
      <Text style={styles.emptyText}>
        {duration === '2h'
          ? 'No hay bloques de 2 horas libres esta semana. Prueba otra semana o cambia a 1 hora.'
          : 'No hay horas libres esta semana. Prueba con la semana siguiente.'}
      </Text>
      {canNext && (
        <TouchableOpacity style={styles.emptyPrimaryBtn} onPress={onNextWeek} activeOpacity={0.85}>
          <Text style={styles.emptyPrimaryText}>Ver semana siguiente</Text>
          <MaterialCommunityIcons name="arrow-right" size={16} color={Colors.onPrimary} />
        </TouchableOpacity>
      )}
      {duration === '2h' && (
        <TouchableOpacity style={styles.emptySecondaryBtn} onPress={onSwitch1h} activeOpacity={0.85}>
          <Text style={styles.emptySecondaryText}>Probar con 1 hora</Text>
        </TouchableOpacity>
      )}
      <View style={styles.emptyNote}>
        <MaterialCommunityIcons name="information-outline" size={13} color={Colors.textDim} />
        <Text style={styles.emptyNoteText}>
          Los huecos = disponibilidad menos reservas, con ≥ {minNoticeHours} h de antelación.
        </Text>
      </View>
    </View>
  );
}

function LoadingGrid() {
  return (
    <View style={styles.gridCard}>
      <View style={styles.gridRow}>
        <View style={styles.hoursColumn}>
          <View style={styles.corner} />
          <View style={styles.hoursList}>
            {Array.from({ length: LOADING_ROWS }).map((_, i) => (
              <View key={i} style={styles.hourLabelCell}>
                <SkeletonBlock width={30} height={12} borderRadius={Radius.sm} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.loadingBody}>
          <View style={styles.daysRow}>
            {Array.from({ length: 5 }).map((_, i) => (
              <View key={i} style={styles.dayHead}>
                <SkeletonBlock width={34} height={28} borderRadius={Radius.md} />
              </View>
            ))}
          </View>
          <View style={styles.cellsRow}>
            {Array.from({ length: 5 }).map((_, c) => (
              <View key={c} style={styles.bodyColumn}>
                {Array.from({ length: LOADING_ROWS }).map((_, r) => (
                  <View key={r} style={styles.cell}>
                    <SkeletonBlock width={CELL_W - 8} height={CELL_H - 8} borderRadius={Radius.md} />
                  </View>
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

function ErrorCard({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.errorCard}>
      <MaterialCommunityIcons name="alert-circle-outline" size={22} color={Colors.error} />
      <Text style={styles.errorText}>
        No pudimos cargar la disponibilidad. Comprueba tu conexión e inténtalo de nuevo.
      </Text>
      <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
        <MaterialCommunityIcons name="refresh" size={16} color={Colors.primary} />
        <Text style={styles.retryBtnText}>Reintentar</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ScheduleScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ duration?: string }>();
  const duration: Duration = params.duration === '2h' ? '2h' : '1h';

  const deviceTz = useMemo(() => getDeviceTimeZone(), []);
  const today = useMemo(() => civilDateInTz(new Date(), deviceTz), [deviceTz]);

  const [weekOffset, setWeekOffset] = useState(0);
  const [state, setState] = useState<ScreenState>('loading');
  const [schedule, setSchedule] = useState<GetScheduleResponse | null>(null);
  const [availByDate, setAvailByDate] = useState<Record<string, AvailabilitySlot[]>>({});
  const [now, setNow] = useState(() => new Date());
  const [selected, setSelected] = useState<Selection | null>(null);
  const [stale, setStale] = useState(false);

  const scheduleRef = useRef<GetScheduleResponse | null>(null);

  const cols = useMemo(() => weekColumns(today, weekOffset), [today, weekOffset]);

  const loadWeek = useCallback(
    async (offset: number) => {
      setState('loading');
      try {
        let sched = scheduleRef.current;
        if (!sched) {
          sched = await api.getSchedule();
          scheduleRef.current = sched;
          setSchedule(sched);
        }
        const weekCols = weekColumns(today, offset);
        const entries = await Promise.all(
          weekCols.map(async (c) => {
            const r = await api.getAvailability({ date: dateKey(c), duration: 60, tz: deviceTz });
            return [dateKey(c), r.slots] as const;
          }),
        );
        setAvailByDate(Object.fromEntries(entries));
        setNow(new Date());
        setState('ready');
      } catch {
        setState('error');
      }
    },
    [today, deviceTz],
  );

  // (Re)load whenever the visible week changes; clear cross-week selection.
  useEffect(() => {
    setSelected(null);
    setStale(false);
    loadWeek(weekOffset);
  }, [weekOffset, loadWeek]);

  const gridModel = useMemo(() => {
    if (!schedule) return null;
    return buildGridModel({ columns: cols, deviceTz, schedule, availabilityByDate: availByDate, now, duration });
  }, [schedule, cols, deviceTz, availByDate, now, duration]);

  const canPrev = weekOffset > 0;
  const canNext = schedule ? weekOffset < schedule.bookingWindowWeeks : false;

  const switchDuration = useCallback((d: Duration) => {
    setSelected(null);
    setStale(false);
    router.setParams({ duration: d });
  }, []);

  // "Hueco tomado": revalidate the picked slot at the decision point.
  const onContinue = useCallback(async () => {
    if (!selected) return;
    try {
      const r = await api.getAvailability({ date: selected.key, duration: 60, tz: deviceTz });
      setAvailByDate((prev) => ({ ...prev, [selected.key]: r.slots }));
      setNow(new Date());
      const stillThere = r.slots.some((s) => s.start === selected.slot.start);
      if (!stillThere) {
        setStale(true);
        setSelected(null);
        return;
      }
    } catch {
      // Network hiccup — let confirm revalidate rather than block the user.
    }
    router.push({
      pathname: '/(tabs)/(booking)/confirm',
      params: { duration, start: selected.slot.start, end: selected.slot.end },
    });
  }, [selected, deviceTz, duration]);

  const selectionLabel = useMemo(() => {
    if (!selected) return null;
    const cd = parseKey(selected.key);
    const day = `${WEEKDAYS_ES[civilWeekday(cd)]} ${cd.day} ${MONTHS_SHORT_ES[cd.month - 1]}`;
    return `${day} · ${hourLabel(selected.hour)}–${hourLabel(selected.hour + 1)}`;
  }, [selected]);

  const showEmpty = state === 'ready' && gridModel != null && !gridModel.hasAnyBookable;

  return (
    <View style={styles.screen}>
      <TopGlow />
      <View style={[styles.chrome, { paddingTop: insets.top + Spacing[2] }]}>
        <Header />
        <DurationToggle duration={duration} onChange={switchDuration} />
        <WeekNav
          cols={cols}
          timezone={schedule?.timezone ?? deviceTz}
          loading={state === 'loading'}
          canPrev={canPrev}
          canNext={canNext}
          onPrev={() => canPrev && setWeekOffset((w) => w - 1)}
          onNext={() => canNext && setWeekOffset((w) => w + 1)}
        />
      </View>

      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
      >
        {stale && (
          <View style={styles.staleBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={Colors.warning} />
            <Text style={styles.staleText}>Esa hora se acaba de ocupar. Elige otro horario.</Text>
          </View>
        )}

        {state === 'loading' && <LoadingGrid />}
        {state === 'error' && <ErrorCard onRetry={() => loadWeek(weekOffset)} />}

        {state === 'ready' && showEmpty && schedule && (
          <EmptyState
            duration={duration}
            minNoticeHours={schedule.minNoticeHours}
            canNext={canNext}
            onNextWeek={() => setWeekOffset((w) => w + 1)}
            onSwitch1h={() => switchDuration('1h')}
          />
        )}

        {state === 'ready' && !showEmpty && gridModel && (
          <Grid model={gridModel} today={today} selected={selected} onSelect={setSelected} />
        )}
      </ScrollView>

      {/* Legend pinned above the dock (only with a grid on screen) */}
      {state === 'ready' && !showEmpty && gridModel && <Legend />}

      {/* Bottom dock — selected-slot summary above a full-width Continuar */}
      <View style={[styles.dock, { paddingBottom: insets.bottom + Spacing[2] }]}>
        <View style={styles.dockInfo}>
          <View style={[styles.dockIcon, !selected && styles.dockIconIdle]}>
            <MaterialCommunityIcons
              name="calendar-check"
              size={18}
              color={selected ? Colors.primary : Colors.textDim}
            />
          </View>
          <View style={styles.dockText}>
            {selected ? (
              <>
                <Text style={styles.dockTime}>{selectionLabel}</Text>
                <Text style={styles.dockSub}>{duration === '2h' ? 'Sesión de 2 horas' : 'Sesión de 1 hora'}</Text>
              </>
            ) : (
              <Text style={styles.dockHint}>Elige un hueco disponible para continuar</Text>
            )}
          </View>
        </View>
        <TouchableOpacity
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          onPress={onContinue}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={[styles.continueText, !selected && styles.continueTextDisabled]}>Continuar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 260,
  },
  chrome: {
    paddingHorizontal: Spacing[4],
    gap: Spacing[3],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    gap: 1,
  },
  headerTitle: {
    ...TypeScale.h3,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  headerSubtitle: {
    ...TypeScale.caption,
    fontSize: 11.5,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Duration toggle
  toggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 4,
    gap: 4,
  },
  toggleSeg: {
    flex: 1,
    height: 34,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSegActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    ...TypeScale.label,
    fontSize: 13,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },
  toggleTextActive: {
    color: Colors.onPrimary,
    fontWeight: '600',
  },

  // Week nav
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
  weekNavLabel: {
    flex: 1,
    gap: 1,
  },
  weekRange: {
    ...TypeScale.h4,
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  weekMeta: {
    ...TypeScale.caption,
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  weekSpinner: {
    marginRight: Spacing[1],
  },
  weekNavBtns: {
    flexDirection: 'row',
    gap: Spacing[2],
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    borderColor: Colors.border,
    backgroundColor: 'transparent',
    opacity: 0.5,
  },

  // Body (vertical page scroll)
  body: {
    flex: 1,
  },
  bodyContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    paddingBottom: Spacing[6],
    gap: Spacing[3],
  },

  // Stale banner
  staleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.warningBg,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[3],
  },
  staleText: {
    ...TypeScale.caption,
    flex: 1,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Grid card
  gridCard: {
    backgroundColor: Colors.surfaceLow,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  gridRow: {
    flexDirection: 'row',
  },

  // Frozen hours column
  hoursColumn: {
    width: HOURS_COL_W,
    borderRightWidth: 1,
    borderRightColor: Colors.border,
  },
  corner: {
    height: HEADER_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  hoursList: {
    paddingTop: ROW_GAP,
  },
  hourLabelCell: {
    height: CELL_H,
    marginBottom: ROW_GAP,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hourLabel: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },

  // Days header (inside the horizontal scroll)
  daysRow: {
    flexDirection: 'row',
    height: HEADER_H,
    alignItems: 'center',
    paddingLeft: COL_GAP,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dayHead: {
    width: CELL_W,
    marginRight: COL_GAP,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayName: {
    ...TypeScale.badge,
    fontSize: 9.5,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  dayNum: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  dayTodayAccent: {
    color: Colors.primary,
  },

  // Cells (inside the horizontal scroll, below the days header)
  cellsRow: {
    flexDirection: 'row',
    paddingLeft: COL_GAP,
    paddingTop: ROW_GAP,
  },
  loadingBody: {
    flex: 1,
  },
  bodyColumn: {
    width: CELL_W,
    marginRight: COL_GAP,
  },
  cell: {
    width: CELL_W,
    height: CELL_H,
    marginBottom: ROW_GAP,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cellText: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: FontFamily.body,
  },
  cellSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 14, spreadDistance: 0, color: 'rgba(78, 222, 163, 0.45)' }],
  },
  cellTextSelected: {
    fontSize: 12.5,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  noFitBadge: {
    fontSize: 8,
    fontWeight: '700',
    fontFamily: FontFamily.body,
    color: CELL_COLORS.noFit2h.text,
  },

  // Legend (pinned above the dock)
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing[3],
    rowGap: Spacing[2],
    justifyContent: 'center',
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[2],
    paddingBottom: Spacing[2],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[1] + 2,
  },
  legendSwatch: {
    width: 13,
    height: 13,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  legendText: {
    ...TypeScale.caption,
    fontSize: 11,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
  },

  // Empty
  emptyCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing[3],
    paddingHorizontal: Spacing[5],
    paddingVertical: Spacing[8],
  },
  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: -0.38,
    fontFamily: FontFamily.headline,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyText: {
    ...TypeScale.bodySm,
    fontSize: 13,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    backgroundColor: Colors.primary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[5],
    marginTop: Spacing[1],
  },
  emptyPrimaryText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.onPrimary,
  },
  emptySecondaryBtn: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[5],
  },
  emptySecondaryText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    marginTop: Spacing[2],
    paddingHorizontal: Spacing[3],
  },
  emptyNoteText: {
    ...TypeScale.caption,
    fontSize: 11,
    flexShrink: 1,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
    textAlign: 'center',
  },

  // Error
  errorCard: {
    alignItems: 'center',
    gap: Spacing[3],
    borderRadius: Radius['3xl'],
    backgroundColor: Colors.errorBg,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    padding: Spacing[5],
  },
  errorText: {
    ...TypeScale.bodySm,
    fontFamily: FontFamily.body,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    gap: Spacing[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius['2xl'],
    borderWidth: 1,
    borderColor: Colors.successBorder,
    backgroundColor: Colors.primaryDim,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[5],
  },
  retryBtnText: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.primary,
    fontWeight: '600',
  },

  // Dock
  dock: {
    gap: Spacing[3],
    paddingHorizontal: Spacing[4],
    paddingTop: Spacing[3],
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surfaceLowest,
  },
  dockInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
  },
  dockIcon: {
    width: 38,
    height: 38,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryDim,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockIconIdle: {
    backgroundColor: Colors.surfaceContainer,
    borderColor: Colors.border,
  },
  dockText: {
    flex: 1,
    gap: 2,
  },
  dockTime: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: FontFamily.headline,
    color: Colors.text,
  },
  dockSub: {
    ...TypeScale.caption,
    fontSize: 12,
    fontFamily: FontFamily.body,
    color: Colors.primary,
  },
  dockHint: {
    ...TypeScale.label,
    fontFamily: FontFamily.body,
    color: Colors.textDim,
  },
  continueBtn: {
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: Colors.surfaceHigh,
  },
  continueText: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: FontFamily.body,
    color: Colors.onPrimary,
  },
  continueTextDisabled: {
    color: Colors.textDim,
  },
});
