// Safe monetary calculation utility
// All money calculations are done in integer cents (1 ETB = 100 cents) to eliminate floating point issues

export class SafeMoney {
  /**
   * Converts a float/string currency amount to integer cents.
   * Throws an error if the amount is invalid, NaN, negative, or infinite.
   */
  static toCents(amount: number | string): number {
    const num = typeof amount === 'string' ? parseFloat(amount.trim()) : amount;
    if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
      throw new Error('Invalid monetary value: amount is not a finite number');
    }
    if (num < 0) {
      throw new Error('Invalid monetary value: amount cannot be negative');
    }
    // Round to nearest integer cent
    return Math.round(num * 100);
  }

  /**
   * Converts integer cents to a 2-decimal rounded number in ETB.
   */
  static fromCents(cents: number): number {
    if (typeof cents !== 'number' || isNaN(cents) || !isFinite(cents)) {
      throw new Error('Invalid cents value');
    }
    return Math.round(cents) / 100;
  }

  /**
   * Formats an amount as ETB string with 2 decimal places e.g. "1,250.50 ETB".
   */
  static format(amount: number): string {
    const clean = SafeMoney.fromCents(SafeMoney.toCents(amount));
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(clean) + ' ETB';
  }

  /**
   * Add two numbers safely via cents.
   */
  static add(a: number, b: number): number {
    return SafeMoney.fromCents(SafeMoney.toCents(a) + SafeMoney.toCents(b));
  }

  /**
   * Subtract b from a safely. Throws if result would be negative.
   */
  static subtract(a: number, b: number): number {
    const aCents = SafeMoney.toCents(a);
    const bCents = SafeMoney.toCents(b);
    if (aCents < bCents) {
      throw new Error(`Insufficient funds: ${a} ETB is less than ${b} ETB`);
    }
    return SafeMoney.fromCents(aCents - bCents);
  }

  /**
   * Multiply an amount by a factor safely.
   */
  static multiply(a: number, factor: number): number {
    if (typeof factor !== 'number' || isNaN(factor) || !isFinite(factor) || factor < 0) {
      throw new Error('Invalid factor');
    }
    const cents = SafeMoney.toCents(a);
    return SafeMoney.fromCents(Math.round(cents * factor));
  }

  /**
   * Calculates a percentage safely.
   */
  static percentOf(amount: number, percent: number): number {
    if (percent < 0 || percent > 100) {
      throw new Error(`Invalid percentage: ${percent}`);
    }
    const cents = SafeMoney.toCents(amount);
    const prizeCents = Math.floor((cents * percent) / 100);
    return SafeMoney.fromCents(prizeCents);
  }
}
