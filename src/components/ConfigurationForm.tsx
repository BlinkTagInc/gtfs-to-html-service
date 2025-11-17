'use client';

import { useState, useCallback, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  GTFSConfigSchema,
  type GTFSConfig,
  defaultGTFSConfig,
} from '@/types/gtfs-config';

interface ConfigurationFormProps {
  onConfigChange: (config: GTFSConfig) => void;
  initialConfig?: Partial<GTFSConfig>;
}

export const ConfigurationForm = ({
  onConfigChange,
  initialConfig,
}: ConfigurationFormProps) => {
  const [activeSection, setActiveSection] = useState<string>('basic');

  const {
    register,
    control,
    formState: { errors },
    getValues,
    setValue,
    watch,
  } = useForm<GTFSConfig>({
    resolver: zodResolver(GTFSConfigSchema),
    defaultValues: {
      ...defaultGTFSConfig,
      ...initialConfig,
    },
  });

  const handleFormChange = useCallback(() => {
    const currentValues = getValues();
    try {
      const validatedConfig = GTFSConfigSchema.parse(currentValues);
      onConfigChange(validatedConfig);
    } catch (error) {
      // Form is invalid, don't update parent
      console.log('Form validation error:', error);
    }
  }, [getValues, onConfigChange]);

  // Watch for form changes and trigger handleFormChange
  useEffect(() => {
    const subscription = watch((value, { name, type }) => {
      if (type === 'change') {
        handleFormChange();
      }
    });

    // Call once on mount to set initial values
    handleFormChange();

    return () => subscription.unsubscribe();
  }, [watch, handleFormChange]);

  const sections = [
    { id: 'basic', label: 'Basic Settings', icon: '⚙️' },
    { id: 'output', label: 'Output Options', icon: '📄' },
    { id: 'display', label: 'Display Options', icon: '👁️' },
    { id: 'map', label: 'Map Options', icon: '🗺️' },
    { id: 'datetime', label: 'Date & Time', icon: '🕐' },
    { id: 'symbols', label: 'Symbols & Text', icon: '🔤' },
    { id: 'advanced', label: 'Advanced Options', icon: '☑️' },
  ];

  const getSectionDescription = (sectionId: string): string => {
    const descriptions: Record<string, string> = {
      basic:
        'Configure core settings like dates, orientation, and timetable organization',
      output: 'Choose output format and beautification options',
      display: 'Control what information appears in your timetables',
      map: 'Configure route maps and coordinate precision',
      datetime: 'Customize date and time formatting and labels',
      symbols: 'Define the symbols and text used within the timetables',
      advanced: 'Advanced sorting algorithms and specialized options',
    };
    return descriptions[sectionId] || 'Configure your timetable settings';
  };

  const renderBasicSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date (Optional)
          </label>
          <div className="relative">
            <input
              key="startDate"
              type="text"
              {...register('startDate')}
              placeholder="YYYY-MM-DD"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Leave empty to use all available service periods within the GTFS.
            Format: YYYY-MM-DD
          </div>
          {errors.startDate && (
            <div className="mt-1 text-sm text-red-600">
              {errors.startDate.message}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date (Optional)
          </label>
          <div className="relative">
            <input
              key="endDate"
              type="text"
              {...register('endDate')}
              placeholder="YYYY-MM-DD"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              pattern="\d{4}-\d{2}-\d{2}"
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Leave empty to use all available service periods within the GTFS.
            Format: YYYY-MM-DD
          </div>
          {errors.endDate && (
            <div className="mt-1 text-sm text-red-600">
              {errors.endDate.message}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Default Timetable Orientation
        </label>
        <select
          key="defaultOrientation"
          {...register('defaultOrientation')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
          <option value="hourly">Hourly</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Menu Type
        </label>
        <select
          {...register('menuType')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="simple">Simple List</option>
          <option value="jump">Jump Menu</option>
          <option value="radio">Radio Buttons</option>
        </select>
      </div>

      <div className="flex items-center">
        <Controller
          name="groupTimetablesIntoPages"
          control={control}
          render={({ field: { onChange, value } }) => (
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          )}
        />
        <label className="ml-2 block text-sm text-gray-700">
          Group timetables for same route onto one page
        </label>
      </div>
    </div>
  );

  const renderOutputSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Output Format
        </label>
        <select
          {...register('outputFormat')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="html">HTML</option>
          <option value="pdf">PDF</option>
          <option value="csv">CSV</option>
        </select>
        {errors.outputFormat && (
          <div className="mt-1 text-sm text-red-600">
            {errors.outputFormat.message}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex items-center">
          <Controller
            name="beautify"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Beautify HTML output
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="noHead"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Skip HTML header and footer
          </label>
        </div>
      </div>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center">
          <Controller
            name="showRouteTitle"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Show route title at top of timetable
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="showCalendarExceptions"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Show calendar exceptions below timetables
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="showDuplicateTrips"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Show duplicate trips with identical stops and times
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="showOnlyTimepoint"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Show only timepoint stops
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="showStopCity"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Show city for each stop
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="showStopDescription"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Show stop descriptions
          </label>
        </div>

        <div>
          <div className="flex items-center">
            <Controller
              name="showStoptimesForRequestStops"
              control={control}
              render={({ field: { onChange, value } }) => (
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(e) => onChange(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
              )}
            />
            <label className="ml-2 block text-sm text-gray-700">
              Show times for request pickup/dropoff stops
            </label>
          </div>
          <div className="text-xs text-gray-500">
            If checked, hide the actual times for stops that require a request
            for pickup or dropoff and just show a symbol.
          </div>
        </div>

        <div className="flex items-center">
          <Controller
            name="linkStopUrls"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Link stop names to stop URLs
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Show Arrival Time Difference Threshold
        </label>
        <input
          type="number"
          step="0.1"
          min="0"
          {...register('showArrivalOnDifference', { valueAsNumber: true })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          Show arrival column when difference ≥ this value (in minutes). Leave
          empty to disable.
        </div>
      </div>
    </div>
  );

  const renderDateTimeSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date Format
        </label>
        <input
          key="dateFormat"
          type="text"
          {...register('dateFormat')}
          placeholder="MMM D, YYYY"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          Moment.js format string (e.g., "MMM D, YYYY" → "Mar 15, 2024")
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Time Format
        </label>
        <input
          key="timeFormat"
          type="text"
          {...register('timeFormat')}
          placeholder="h:mma"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          Moment.js format string (e.g., "h:mma" → "8:36pm")
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weekday Names
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {[
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday',
            'Sunday',
          ].map((day, index) => (
            <input
              key={day}
              type="text"
              {...register(`daysStrings.${index}` as const)}
              className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Weekday Abbreviations
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
            (day, index) => (
              <input
                key={day}
                type="text"
                {...register(`daysShortStrings.${index}` as const)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ),
          )}
        </div>
      </div>
    </div>
  );

  const renderSymbolsSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Service Symbol
          </label>
          <input
            type="text"
            {...register('noServiceSymbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Service Text
          </label>
          <input
            type="text"
            {...register('noServiceText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Pickup Symbol
          </label>
          <input
            type="text"
            {...register('noPickupSymbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Pickup Text
          </label>
          <input
            type="text"
            {...register('noPickupText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Dropoff Symbol
          </label>
          <input
            type="text"
            {...register('noDropoffSymbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Dropoff Text
          </label>
          <input
            type="text"
            {...register('noDropoffText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Request Pickup Symbol
          </label>
          <input
            type="text"
            {...register('requestPickupSymbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Request Pickup Text
          </label>
          <input
            type="text"
            {...register('requestPickupText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Request Dropoff Symbol
          </label>
          <input
            type="text"
            {...register('requestDropoffSymbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Request Dropoff Text
          </label>
          <input
            type="text"
            {...register('requestDropoffText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interpolated Stop Symbol
          </label>
          <input
            type="text"
            {...register('interpolatedStopSymbol')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Interpolated Stop Text
          </label>
          <input
            type="text"
            {...register('interpolatedStopText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Provided Text
          </label>
          <input
            type="text"
            {...register('serviceProvidedOnText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Service Not Provided Text
          </label>
          <input
            type="text"
            {...register('serviceNotProvidedOnText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            No Regular Service Days Text
          </label>
          <input
            type="text"
            {...register('noRegularServiceDaysText')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Effective Date (Optional)
          </label>
          <input
            type="text"
            {...register('effectiveDate')}
            placeholder="e.g., March 15, 2024"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="mt-1 text-xs text-gray-500">
            Date to print at the top of timetables, leave blank to omit
          </div>
          {errors.effectiveDate && (
            <div className="mt-1 text-sm text-red-600">
              {errors.effectiveDate.message}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderMapSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center">
        <Controller
          name="showMap"
          control={control}
          render={({ field: { onChange, value } }) => (
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
          )}
        />
        <label className="ml-2 block text-sm text-gray-700">
          Show route map on timetable
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Map Style URL
        </label>
        <input
          key="mapStyleUrl"
          type="url"
          {...register('mapStyleUrl')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          MapLibre style URL for route maps
        </div>
        {errors.mapStyleUrl && (
          <div className="mt-1 text-sm text-red-600">
            {errors.mapStyleUrl.message}
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Coordinate Precision
        </label>
        <input
          type="number"
          min="0"
          max="10"
          {...register('coordinatePrecision', { valueAsNumber: true })}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          Number of decimal places for GeoJSON coordinates (0-10)
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Trip Sorting Algorithm
        </label>
        <select
          {...register('sortingAlgorithm')}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="common">Common Stop</option>
          <option value="beginning">Beginning Stop</option>
          <option value="end">End Stop</option>
          <option value="first">First Stop of Longest Trip</option>
          <option value="last">Last Stop of Longest Trip</option>
        </select>
        <div className="mt-1 text-xs text-gray-500">
          Algorithm used to determine trip order in timetables
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center">
          <Controller
            name="allowEmptyTimetables"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Generate timetables with no trips
          </label>
        </div>

        <div className="flex items-center">
          <Controller
            name="useParentStation"
            control={control}
            render={({ field: { onChange, value } }) => (
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            )}
          />
          <label className="ml-2 block text-sm text-gray-700">
            Use parent station instead of platform stop_id
          </label>
        </div>
      </div>
    </div>
  );

  const renderSection = () => {
    switch (activeSection) {
      case 'basic':
        return renderBasicSettings();
      case 'output':
        return renderOutputSettings();
      case 'display':
        return renderDisplaySettings();
      case 'datetime':
        return renderDateTimeSettings();
      case 'symbols':
        return renderSymbolsSettings();
      case 'map':
        return renderMapSettings();
      case 'advanced':
        return renderAdvancedSettings();
      default:
        return renderBasicSettings();
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Mobile Navigation - Horizontal Tabs */}
      <div className="md:hidden">
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-gray-200 p-2">
          <div className="flex overflow-x-auto space-x-1 pb-2 scrollbar-hide">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 bg-white hover:bg-gray-50 border border-gray-200'
                }`}
              >
                <span className="mr-1">{section.icon}</span>
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <h4 className="text-lg font-bold text-gray-900">
            {sections.find((s) => s.id === activeSection)?.label}
          </h4>
          <p className="text-sm text-gray-600 mt-1">
            {getSectionDescription(activeSection)}
          </p>
        </div>

        {/* Mobile Content */}
        <div className="px-4 py-4">
          <form key={activeSection}>{renderSection()}</form>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex min-h-[600px]">
        {/* Desktop Sidebar Navigation */}
        <div className="w-60 lg:w-72 bg-gradient-to-b from-slate-50 to-slate-100 border-r border-gray-200 flex flex-col">
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {sections.map((section, index) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`group w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ease-in-out transform hover:scale-[1.02] ${
                  activeSection === section.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25 border border-blue-500'
                    : 'text-gray-700 hover:bg-white hover:text-gray-900 hover:shadow-md border border-transparent hover:border-gray-200'
                }`}
              >
                <div className="flex items-center">
                  <span
                    className={`text-lg mr-3 transition-transform duration-200 ${
                      activeSection === section.id
                        ? 'scale-110'
                        : 'group-hover:scale-105'
                    }`}
                  >
                    {section.icon}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{section.label}</div>
                  </div>
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* Desktop Main Content */}
        <div className="flex-1 relative">
          {/* Desktop Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-2xl font-bold text-gray-900">
                  {sections.find((s) => s.id === activeSection)?.label}
                </h4>
                <div className="text-gray-600 mt-1">
                  {getSectionDescription(activeSection)}
                </div>
              </div>
            </div>
          </div>

          {/* Desktop Content */}
          <div className="px-6 py-6 max-h-[calc(100vh-200px)] overflow-y-auto">
            <form key={activeSection}>
              <div className="max-w-4xl">{renderSection()}</div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
