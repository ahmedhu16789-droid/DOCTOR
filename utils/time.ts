export const formatTimeTo12Hour = (time: string): string => {
  const [rawHours, rawMinutes] = time.split(':');
  const hours = Number.parseInt(rawHours, 10);
  const minutes = Number.parseInt(rawMinutes, 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? 'مساءً' : 'صباحًا';
  const normalizedHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(normalizedHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};

export const formatDateTo12Hour = (date: Date): string => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'مساءً' : 'صباحًا';
  const normalizedHour = hours % 12 === 0 ? 12 : hours % 12;

  return `${String(normalizedHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
};
