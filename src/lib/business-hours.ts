interface DayPeriod {
  start: string; // "18:00"
  end: string;   // "23:00"
}

interface BusinessHourDay {
  day_of_week: number;
  is_open: boolean;
  periods: DayPeriod[];
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const WEEKDAYS = [1, 2, 3, 4, 5] as const; // Segunda a Sexta
const WEEKEND = [5, 6] as const; // Sábado e Domingo

/**
 * Aplica os horários de um dia para os outros dias especificados.
 */
export function applyHoursToMultipleDays(
  currentHours: any[],
  sourceDay: number,
  targetDays: number[]
): any[] {
  const source = currentHours.filter(h => h.day_of_week === sourceDay && !h.toDelete);
  if (source.length === 0) return currentHours;

  // Remove existing hours for target days
  const toDelete = currentHours
    .filter(h => targetDays.includes(h.day_of_week) && !h.toDelete)
    .map(h => h.id);

  // Create new hours for target days
  const newHours: any[] = [];
  targetDays.forEach(targetDay => {
    source.forEach((period, index) => {
      newHours.push({
        id: `new-${Date.now()}-${targetDay}-${index}`,
        restaurant_id: period.restaurant_id,
        day_of_week: targetDay,
        is_open: true,
        opening_time: period.opening_time,
        closing_time: period.closing_time,
        period_order: index,
        isNew: true,
      });
    });
  });

  // Mark existing hours for deletion
  const updated = currentHours.map(h => {
    if (toDelete.includes(h.id) && !h.isNew) {
      return { ...h, toDelete: true };
    }
    return h;
  });

  return [...updated, ...newHours];
}

/**
 * Helpers para selecionar grupos de dias.
 */
export const dayGroups = {
  all: () => [...ALL_DAYS],
  weekdays: () => [...WEEKDAYS],
  weekend: () => [...WEEKEND],
  except: (excluded: number) => ALL_DAYS.filter(d => d !== excluded),
};
