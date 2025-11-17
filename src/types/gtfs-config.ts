import { z } from 'zod';

// Agency configuration schema
export const AgencySchema = z.object({
  agencyKey: z.string().min(1, 'Agency key is required'),
  url: z.string().url('Must be a valid URL').optional(),
  path: z.string().optional(),
  exclude: z.array(z.string()).optional(),
  headers: z.record(z.string(), z.string()).optional(),
  realtimeUrls: z.array(z.string().url('Must be a valid URL')).optional(),
  realtimeHeaders: z.record(z.string(), z.string()).optional(),
  proj: z.string().optional(),
});

// Main GTFS configuration schema
export const GTFSConfigSchema = z.object({
  // Output options
  outputFormat: z.enum(['html', 'pdf', 'csv']).optional(),

  // Display options
  beautify: z.boolean().optional(),
  noHead: z.boolean().optional(),
  showRouteTitle: z.boolean().optional(),
  showMap: z.boolean().optional(),
  showCalendarExceptions: z.boolean().optional(),
  showDuplicateTrips: z.boolean().optional(),
  showOnlyTimepoint: z.boolean().optional(),
  showStopCity: z.boolean().optional(),
  showStopDescription: z.boolean().optional(),
  showStoptimesForRequestStops: z.boolean().optional(),
  linkStopUrls: z.boolean().optional(),

  // Timetable organization
  groupTimetablesIntoPages: z.boolean().optional(),
  allowEmptyTimetables: z.boolean().optional(),
  defaultOrientation: z.enum(['vertical', 'horizontal', 'hourly']).optional(),
  menuType: z.enum(['jump', 'simple', 'radio']).optional(),
  sortingAlgorithm: z
    .enum(['common', 'beginning', 'end', 'first', 'last'])
    .optional(),

  // Date and time formatting
  dateFormat: z.string().optional(),
  timeFormat: z.string().optional(),
  effectiveDate: z.string().optional(),
  startDate: z
    .string()
    .refine(
      (val) => val === '' || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Must be in YYYY-MM-DD format or empty',
    )
    .optional(),
  endDate: z
    .string()
    .refine(
      (val) => val === '' || /^\d{4}-\d{2}-\d{2}$/.test(val),
      'Must be in YYYY-MM-DD format or empty',
    )
    .optional(),

  // Day labels
  daysStrings: z.array(z.string()).length(7).optional(),
  daysShortStrings: z.array(z.string()).length(7).optional(),

  // Service text
  serviceProvidedOnText: z.string().optional(),
  serviceNotProvidedOnText: z.string().optional(),
  noRegularServiceDaysText: z.string().optional(),

  // Stop symbols and text
  noServiceSymbol: z.string().optional(),
  noServiceText: z.string().optional(),
  noPickupSymbol: z.string().optional(),
  noPickupText: z.string().optional(),
  noDropoffSymbol: z.string().optional(),
  noDropoffText: z.string().optional(),
  requestPickupSymbol: z.string().optional(),
  requestPickupText: z.string().optional(),
  requestDropoffSymbol: z.string().optional(),
  requestDropoffText: z.string().optional(),
  interpolatedStopSymbol: z.string().optional(),
  interpolatedStopText: z.string().optional(),

  // Advanced options
  coordinatePrecision: z.number().min(0).max(10).optional(),
  showArrivalOnDifference: z
    .union([z.number().min(0), z.nan()])
    .transform((val) => (isNaN(val) ? undefined : val))
    .optional(),
  useParentStation: z.boolean().optional(),

  // Map configuration
  mapStyleUrl: z.string().url('Must be a valid URL').optional(),
});

export type GTFSConfig = z.infer<typeof GTFSConfigSchema>;
export type Agency = z.infer<typeof AgencySchema>;

// Default configuration values
export const defaultGTFSConfig: Partial<GTFSConfig> = {
  outputFormat: 'html',
  beautify: false,
  noHead: false,
  showRouteTitle: true,
  showMap: true,
  showCalendarExceptions: true,
  showDuplicateTrips: false,
  showOnlyTimepoint: false,
  showStopCity: false,
  showStopDescription: false,
  showStoptimesForRequestStops: true,
  linkStopUrls: false,
  groupTimetablesIntoPages: true,
  allowEmptyTimetables: false,
  defaultOrientation: 'vertical',
  menuType: 'radio',
  sortingAlgorithm: 'common',
  dateFormat: 'MMM D, YYYY',
  timeFormat: 'h:mma',
  daysStrings: [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ],
  daysShortStrings: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  serviceProvidedOnText: 'Service provided on',
  serviceNotProvidedOnText: 'Service not provided on',
  noRegularServiceDaysText: 'No regular service days',
  noServiceSymbol: '—',
  noServiceText: 'No service at this stop',
  noPickupSymbol: '**',
  noPickupText: 'No pickup available',
  noDropoffSymbol: '‡',
  noDropoffText: 'No drop off available',
  requestPickupSymbol: '***',
  requestPickupText: 'Request stop - call for pickup',
  requestDropoffSymbol: '†',
  requestDropoffText: 'Must request drop off',
  interpolatedStopSymbol: '•',
  interpolatedStopText: 'Estimated time of arrival',
  coordinatePrecision: 5,
  useParentStation: true,
  mapStyleUrl: 'https://tiles.openfreemap.org/styles/positron',
  // Keep start and end dates empty by default
  startDate: '',
  endDate: '',
};
