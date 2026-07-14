/** 15-minute time-of-day options between minTime and maxTime (inclusive), "HH:mm" format. */
export function generateTimeOptions(
  minTime = "09:00",
  maxTime = "22:00"
): { label: string; value: string }[] {
  const options = [];
  const [minH, minM] = minTime.split(":").map(Number);
  const [maxH, maxM] = maxTime.split(":").map(Number);

  const start = minH * 60 + minM;
  const end = maxH * 60 + maxM;

  for (let m = start; m <= end; m += 15) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    const time = `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
    options.push({ label: time, value: time });
  }
  return options;
}
