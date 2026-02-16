export const monthKey = (date: string) => date.slice(0, 7);

export const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};

export const previousMonthKey = () => {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = prev.getFullYear();
  const month = `${prev.getMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
};
