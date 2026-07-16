/**
 * Log Tracker Calculations & Aggregates
 */

/**
 * Gets the Date object for the start of the current calendar week (Monday, 00:00:00).
 * @returns {Date}
 */
export function getStartOfWeek() {
  const now = new Date();
  const day = now.getDay();
  // adjust when day is Sunday (0) to get Monday (-6)
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Gets the Date object for the end of the current calendar week (Sunday, 23:59:59).
 * @returns {Date}
 */
export function getEndOfWeek() {
  const start = getStartOfWeek();
  const sunday = new Date(start);
  sunday.setDate(start.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Computes lifetime and weekly aggregates for all numeric fields in the tracker's schema.
 * @param {Array<object>} entries 
 * @param {Array<object>} schema 
 * @returns {object} Maps field key -> { sumLifetime, avgLifetime, sumThisWeek, countThisWeek, minLifetime, maxLifetime }
 */
export function calculateAggregates(entries, schema) {
  const result = {};
  const numericFields = schema.filter(f => f.kind === 'number');
  const dateField = schema.find(f => f.kind === 'date');

  const startOfWeek = getStartOfWeek();
  const endOfWeek = getEndOfWeek();

  numericFields.forEach(field => {
    let sumLifetime = 0;
    let countLifetime = 0;
    let sumThisWeek = 0;
    let countThisWeek = 0;
    let minLifetime = Infinity;
    let maxLifetime = -Infinity;

    entries.forEach(entry => {
      const val = Number(entry[field.key]);
      if (isNaN(val) || entry[field.key] === null || entry[field.key] === undefined || entry[field.key] === '') {
        return; // skip non-numeric/empty values
      }

      // Lifetime math
      sumLifetime += val;
      countLifetime++;
      if (val < minLifetime) minLifetime = val;
      if (val > maxLifetime) maxLifetime = val;

      // Weekly math (if date is present)
      if (dateField && entry[dateField.key]) {
        const entryDate = new Date(entry[dateField.key]);
        if (!isNaN(entryDate.getTime()) && entryDate >= startOfWeek && entryDate <= endOfWeek) {
          sumThisWeek += val;
          countThisWeek++;
        }
      }
    });

    result[field.key] = {
      sumLifetime: countLifetime > 0 ? sumLifetime : 0,
      avgLifetime: countLifetime > 0 ? (sumLifetime / countLifetime) : 0,
      sumThisWeek: sumThisWeek,
      countThisWeek: countThisWeek,
      minLifetime: minLifetime !== Infinity ? minLifetime : 0,
      maxLifetime: maxLifetime !== -Infinity ? maxLifetime : 0,
      countLifetime
    };
  });

  return result;
}
