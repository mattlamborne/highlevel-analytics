import { Injectable, Logger } from '@nestjs/common';

export type SubscriptionStatus = 'scheduled' | 'active' | 'churned';

@Injectable()
export class SubscriptionCalculatorService {
  private readonly logger = new Logger(SubscriptionCalculatorService.name);

  /**
   * Calculate subscription status based on start and departing dates
   */
  calculateStatus(
    startDate: Date | null,
    departingDate: Date | null,
    referenceDate: Date = new Date(),
  ): SubscriptionStatus {
    // No start date yet - scheduled for future
    if (!startDate) {
      return 'scheduled';
    }

    // Future start date - scheduled
    if (startDate > referenceDate) {
      return 'scheduled';
    }

    // No departing date or future departing date - active
    if (!departingDate || departingDate > referenceDate) {
      return 'active';
    }

    // Past departing date - churned
    return 'churned';
  }

  /**
   * Calculate Lifetime Value (LTV)
   * LTV = MRR × tenure (in months)
   */
  calculateLTV(
    mrr: number | null,
    startDate: Date | null,
    departingDate: Date | null,
  ): number {
    if (!mrr || !startDate) {
      return 0;
    }

    const endDate = departingDate || new Date();
    const tenureMonths = this.calculateTenureMonths(startDate, endDate);

    return mrr * tenureMonths;
  }

  /**
   * Calculate tenure in months between two dates
   */
  calculateTenureMonths(startDate: Date, endDate: Date): number {
    const years = endDate.getFullYear() - startDate.getFullYear();
    const months = endDate.getMonth() - startDate.getMonth();
    const totalMonths = years * 12 + months;

    // Ensure minimum of 0 months
    return Math.max(0, totalMonths);
  }

  /**
   * Parse a custom field value as a date
   * Supports ISO strings and timestamps
   */
  parseDate(value: any): Date | null {
    if (!value) return null;

    // Already a Date object
    if (value instanceof Date) {
      return value;
    }

    // String (ISO format)
    if (typeof value === 'string') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Number (timestamp)
    if (typeof value === 'number') {
      const parsed = new Date(value);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  /**
   * Parse a custom field value as a number (for MRR)
   */
  parseNumber(value: any): number | null {
    if (value === null || value === undefined) return null;

    const parsed = typeof value === 'number' ? value : parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  }
}
