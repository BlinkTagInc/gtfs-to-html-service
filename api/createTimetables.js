const Boom = require('@hapi/boom')
const { v4: uuidv4 } = require('uuid')
const fs = require('fs-extra')
const path = require('path')
const { createTimetablesSocketless } = require('../util/create');

const defaultTemplate = 'default'
const defaultOptions = {
  allowEmptyTimetables: false,
  beautify: false,
  coordinatePrecision: 5,
  dateFormat: 'MMM D, YYYY',
  daysShortStrings: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  daysStrings: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  defaultOrientation: 'vertical',
  interpolatedStopSymbol: '•',
  interpolatedStopText: 'Estimated time of arrival',
  linkStopUrls: true,
  menuType: 'jump',
  noDropoffSymbol: '‡',
  noDropoffText: 'No drop off available',
  noHead: false,
  noPickupSymbol: '**',
  noPickupText: 'No pickup available',
  noServiceSymbol: '-',
  noServiceText: 'No service at this stop',
  outputFormat: 'html',
  requestDropoffSymbol: '†',
  requestDropoffText: 'Must request drop off',
  requestPickupSymbol: '***',
  requestPickupText: 'Request stop - call for pickup',
  serviceNotProvidedOnText: 'Service not provided on',
  serviceProvidedOnText: 'Service provided on',
  showArrivalOnDifference: 0.2,
  showMap: false,
  showOnlyTimepoint: false,
  showRouteTitle: true,
  showStopCity: false,
  showStopDescription: false,
  sortingAlgorithm: 'common',
  timeFormat: 'h:mma',
  useParentStation: true,
};

module.exports = async (request, h) => {
  const { options, url, template = defaultTemplate } = request.payload

  if (!/^(f|ht)tps?:\/\//i.test(url)) {
    throw Boom.badRequest('Invalid URL')
  }

  if (!/\.(zip)/g.test(url)) {
    throw Boom.badRequest('Invalid extension, url should end with .zip')
  }

  const data = {
    url,
    buildId: uuidv4(),
    options: {
      ...defaultOptions,
      ...options
    },
    template
  }

  try {
    return await createTimetablesSocketless(data)
  } catch (error) {
    request.log('error', error)
    throw Boom.boomify(error)
  }
}
