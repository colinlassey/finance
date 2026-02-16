export const monthKey = (date: string) => date.slice(0, 7);

export const daysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
};
