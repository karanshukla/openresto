/**
 * How many days past today the date picker offers unless the caller sets a window of its own.
 * Lives apart from the two picker implementations because both read it and neither may import
 * the other: Metro's platform resolution would make `DatePicker.web` importing `DatePicker`
 * resolve to itself.
 */
export const DEFAULT_DAYS_AHEAD = 29;
