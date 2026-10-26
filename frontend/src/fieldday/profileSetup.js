// Mirrors the backend's first-run setup rules and weekly availability values.

export const WEEKDAYS = [
  { value: 'MON', label: 'Mon' },
  { value: 'TUE', label: 'Tue' },
  { value: 'WED', label: 'Wed' },
  { value: 'THU', label: 'Thu' },
  { value: 'FRI', label: 'Fri' },
  { value: 'SAT', label: 'Sat' },
  { value: 'SUN', label: 'Sun' },
];

export const DAY_PERIODS = [
  { value: 'MORNING', label: 'Morning' },
  { value: 'AFTERNOON', label: 'Afternoon' },
  { value: 'EVENING', label: 'Evening' },
];

// How each missing setup step is described to the user.
export const SETUP_STEP_LABELS = {
  name: 'a name',
  sports: 'at least one sport and skill level',
  availability: 'when you are usually free',
};

// The same checks as the server's profileSetupMissing, for the form. A photo
// is optional.
export function missingSetupSteps({ name, skills, availability }) {
  const missing = [];
  if (!name.trim()) missing.push('name');
  if (skills.length === 0) missing.push('sports');
  if (!availability.some(({ periods }) => periods.length > 0)) missing.push('availability');
  return missing;
}

// "at least one sport and skill level and when you are usually free"
export function describeSteps(steps) {
  const labels = steps.map((step) => SETUP_STEP_LABELS[step] || step);
  if (labels.length <= 1) return labels.join('');
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

// Turns the form's { MON: ['EVENING'], ... } into the API's sorted list.
export function availabilityList(byDay) {
  return WEEKDAYS
    .map(({ value }) => ({
      day: value,
      periods: DAY_PERIODS.map((period) => period.value).filter((period) => byDay[value]?.includes(period)),
    }))
    .filter(({ periods }) => periods.length > 0);
}

export function availabilityByDay(list = []) {
  return Object.fromEntries(list.map(({ day, periods }) => [day, [...periods]]));
}

// "Mon evening", "Sat morning, afternoon"
export function formatAvailability(list = []) {
  return list.map(({ day, periods }) => {
    const dayLabel = WEEKDAYS.find((item) => item.value === day)?.label || day;
    const periodLabels = periods.map((period) => DAY_PERIODS.find((item) => item.value === period)?.label.toLowerCase() || period);
    return `${dayLabel} ${periodLabels.join(', ')}`;
  });
}
