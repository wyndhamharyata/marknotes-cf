export const SLOT_3H_SECONDS = 3 * 60 * 60;

export function roundDownToSlot(date: Date, slotSeconds: number): Date {
  const ts = Math.floor(date.getTime() / 1000);
  const rounded = Math.floor(ts / slotSeconds) * slotSeconds;
  return new Date(rounded * 1000);
}
