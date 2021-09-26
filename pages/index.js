import React, {useState, useEffect} from 'react';
import Head from 'next/head.js';

import io from 'socket.io-client';
import {initGA, logPageView, logEvent} from '../util/analytics.js';
const socket = io('/');

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

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
  mapboxAccessToken: 'PUT YOUR MAPBOX ACCESS TOKEN HERE',
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
  showMap: true,
  showOnlyTimepoint: false,
  showRouteTitle: true,
  showStopCity: false,
  showStopDescription: false,
  sortingAlgorithm: 'common',
  timeFormat: 'h:mma',
  useParentStation: true
};

function Home() {
  const [url, setUrl] = useState('');
  const [options, setOptions] = useState(JSON.stringify(defaultOptions, null, 2));
  const [showOptions, setShowOptions] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [buildId, setBuildId] = useState();
  const [locations, setLocations] = useState();
  const [selectedLocation, setSelectedLocation] = useState('');
  const [feeds, setFeeds] = useState();
  const [selectedFeed, setSelectedFeed] = useState('');

  const statusContainer = React.createRef();

  useEffect(() => {
    if (!window.GA_INITIALIZED) {
      initGA();
      window.GA_INITIALIZED = true;
    }

    logPageView();
  }, []);

  useEffect(() => {
    socket.on('status', payload => {
      if (statuses.length > 0 && payload.overwrite === true) {
        statuses.splice(-1, 1, payload);
      } else {
        statuses.push(payload);
      }

      setStatuses([...statuses]);
    });

    fetch('/api/locations')
      .then(res => res.json())
      .then(response => {
        if (response && response.results && response.results.locations) {
          setLocations(response.results.locations);
        }
      });
  }, []);

  useEffect(() => {
    const element = statusContainer.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [statuses]);

  useEffect(() => {
    if (selectedFeed) {
      fetch(`/api/feed-versions?feed=${selectedFeed}`)
        .then(res => res.json())
        .then(response => {
          if (response && response.results && response.results.versions && response.results.versions.length > 0) {
            setUrl(response.results.versions[0].url);
          } else {
            const locationName = locations.find(l => l.id.toString() === selectedLocation).t;
            alert(`Unable to find any valid feed URLs for ${locationName}`);
          }
        });
    }
  }, [selectedFeed]);

  const handleUrlChange = event => {
    setUrl(event.target.value);
    if (feeds && selectedFeed && event.target.value !== feeds.find(f => f.id === selectedFeed).u.d) {
      // Reset feed and location select
      setSelectedFeed('');
      setSelectedLocation('');
      setFeeds();
    }
  };

  const handleOptionsChange = event => {
    setOptions(event.target.value);
  };

  const handleSubmit = async event => {
    if (event) {
      event.preventDefault();
    }

    setProcessing(true);

    let parsedOptions;
    try {
      parsedOptions = JSON.parse(options);
    } catch {
      setStatuses([{error: 'Invalid JSON supplied for GTFS-to-HTML options'}]);
      setProcessing(false);
      return;
    }

    setStatuses([]);

    if (!/^(f|ht)tps?:\/\//i.test(url)) {
      setStatuses([{error: 'Please enter a valid URL'}]);
      setProcessing(false);
      return;
    }

    const buildId = uuidv4();
    socket.emit('create', {
      url,
      buildId,
      options: parsedOptions
    });

    setBuildId(buildId);
    setProcessing(false);

    logEvent('GTFS', 'create', url);
  };

  const handleLocationChange = e => {
    const newLocationId = e.target.value;
    setSelectedLocation(newLocationId);
    setFeeds();
    setUrl('');
    fetch(`/api/feeds?location=${newLocationId}&limit=100`)
      .then(res => res.json())
      .then(response => {
        if (response && response.results && response.results.feeds) {
          const filteredFeeds = response.results.feeds.filter(f => f.ty === 'gtfs');
          setFeeds(filteredFeeds);

          if (filteredFeeds.length === 0) {
            const locationName = locations.find(l => l.id.toString() === newLocationId).t;
            alert(`No GTFS feeds found for ${locationName}`);
          }

          if (filteredFeeds.length === 1) {
            setSelectedFeed(filteredFeeds[0].id);
          }
        }
      });
  };

  const renderLocationOption = location => {
    return (
      <option key={location.id} value={location.id}>{location.t}</option>
    );
  };

  const renderFeedOption = feed => {
    return (
      <option key={feed.id} value={feed.id}>{feed.t}</option>
    );
  };

  const renderOptions = () => {
    if (showOptions) {
      return (
        <div className="form-group mx-sm-3">
          <small className="form-text text-muted ml-1">
            GTFS-to-HTML options{' '}
            <a href="https://gtfstohtml.com/docs/configuration" target="_blank">read more</a>
          </small>
          <textarea
            className="form-control form-control-sm form-control-options mt-3 mt-md-0"
            value={options}
            onChange={handleOptionsChange}
            style={{height: '400px'}}
          />
        </div>
      );
    }

    return (
      <div className="form-group mx-sm-3">
        <button className="btn btn-sm" onClick={() => setShowOptions(true)}>Customize options</button>
      </div>
    );
  };

  const renderUrlForm = () => {
    if (processing) {
      return null;
    }

    return (
      <div>
        <h1>Generate HTML timetables from GTFS</h1>
        <form className="url-form" onSubmit={handleSubmit}>
          <div className="form-group mx-sm-3 url-form-group">
            <select
              className="form-control form-control-lg"
              onChange={handleLocationChange}
              value={selectedLocation}
            >
              <option value="">Select a Region</option>
              {locations && locations.map(renderLocationOption)}
            </select>
          </div>
          {feeds && feeds.length > 1 && <div className="form-group mx-sm-3 url-form-group">
            <select
              className="form-control form-control-lg"
              onChange={e => setSelectedFeed(e.target.value)}
              value={selectedFeed}
            >
              <option value="">Select a GTFS Feed</option>
              {feeds.map(renderFeedOption)}
            </select>
          </div>}
          <div className="form-group mx-sm-3 url-form-group">
            <small className="form-text text-muted ml-1">
              or direcly enter the URL of a zipped GTFS file
            </small>
            <input
              type="text"
              placeholder="URL of zipped GTFS file"
              className="form-control form-control-lg form-control-url mt-3 mt-md-0"
              value={url}
              onChange={handleUrlChange}
            />
          </div>
          {renderOptions()}
          <div className="form-group mx-sm-3 url-form-group">
            <input type="submit" value="Create HTML Timetables" className="btn btn-primary btn-lg btn-block" />
          </div>
        </form>

        {statuses.length === 0 && <div className="row">
          <div className="col-sm-8 offset-sm-2 mt-lg-5 mt-2">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">What is this tool?</h5>
                <div className="row mb-4">
                  <div className="col-3 display-4 text-center">
                    🚆
                  </div>
                  <div className="col-9">
                    <p className="card-text">GTFS-to-HTML creates human-readable, user-friendly transit timetables in HTML format directly from GTFS transit data.</p>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-3 display-4 text-center">
                    🕑
                  </div>
                  <div className="col-9">
                    <p className="card-text">Most transit agencies have schedule data in GTFS format but need to show each route's schedule to users on a website.</p>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-3 display-4 text-center">
                    🖥
                  </div>
                  <div className="col-9">
                    <p className="card-text">GTFS allows transit data to be published to apps like Google Maps and Citymapper. HTML is a human-readable format (like this website).</p>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-3 display-4 text-center">
                    🧰
                  </div>
                  <div className="col-9">
                    <p className="card-text">This tool automates the process of creating nicely formatted HTML or PDF timetables for inclusion on a transit agency website.</p>
                  </div>
                </div>

                <div className="row mb-4">
                  <div className="col-3 display-4 text-center">
                    ✅
                  </div>
                  <div className="col-9">
                    <p className="card-text">Automating timetable creation means that timetables can be kept up to date and accurate when schedule changes happen and the likelihood of errors is reduced.</p>
                  </div>
                </div>

                <div className="row">
                  <div className="col">
                    <a href="https://gtfstohtml.com/" className="btn btn-sm btn-primary btn-block">Read more</a>
                  </div>
                  <div className="col">
                    <a href="https://gtfs.org/" className="btn btn-sm btn-secondary btn-block">Read more about GTFS</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>}

        <style jsx>{`
          .url-form {
            margin-bottom: 25px;
            align-items: flex-start;
          }

          @media (min-width: 576px) {
            .url-form {
              align-self: stretch;
            }
            .form-inline .url-form-group {
              flex: 1;
            }
            .form-inline .form-control-url {
              width: 100%;
            }
          }
        `}</style>
      </div>
    );
  };

  const renderLoading = () => {
    if (!processing) {
      return null;
    }

    return (
      <div className="loading">
        <h2>Generating HTML Timetables</h2>
        <p>from {url}</p>
        <div className="lds-roller"><div></div><div></div><div></div><div></div><div></div><div></div><div></div><div></div></div>
        <style jsx>{`
          .loading {
            text-align: center;
          }
          .lds-roller {
            display: inline-block;
            position: relative;
            width: 64px;
            height: 64px;
            margin-top: 20px;
            margin-bottom: 20px;
          }
          .lds-roller div {
            animation: lds-roller 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
            transform-origin: 32px 32px;
          }
          .lds-roller div:after {
            content: " ";
            display: block;
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #000;
            margin: -3px 0 0 -3px;
          }
          .lds-roller div:nth-child(1) {
            animation-delay: -0.036s;
          }
          .lds-roller div:nth-child(1):after {
            top: 50px;
            left: 50px;
          }
          .lds-roller div:nth-child(2) {
            animation-delay: -0.072s;
          }
          .lds-roller div:nth-child(2):after {
            top: 54px;
            left: 45px;
          }
          .lds-roller div:nth-child(3) {
            animation-delay: -0.108s;
          }
          .lds-roller div:nth-child(3):after {
            top: 57px;
            left: 39px;
          }
          .lds-roller div:nth-child(4) {
            animation-delay: -0.144s;
          }
          .lds-roller div:nth-child(4):after {
            top: 58px;
            left: 32px;
          }
          .lds-roller div:nth-child(5) {
            animation-delay: -0.18s;
          }
          .lds-roller div:nth-child(5):after {
            top: 57px;
            left: 25px;
          }
          .lds-roller div:nth-child(6) {
            animation-delay: -0.216s;
          }
          .lds-roller div:nth-child(6):after {
            top: 54px;
            left: 19px;
          }
          .lds-roller div:nth-child(7) {
            animation-delay: -0.252s;
          }
          .lds-roller div:nth-child(7):after {
            top: 50px;
            left: 14px;
          }
          .lds-roller div:nth-child(8) {
            animation-delay: -0.288s;
          }
          .lds-roller div:nth-child(8):after {
            top: 45px;
            left: 10px;
          }
          @keyframes lds-roller {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }          
        `}</style>
      </div>
    );
  };

  const formatStatusText = text => text && typeof text === 'string' ? text.replace(`${buildId}: `, '') : '';

  const renderStatus = () => {
    if (statuses.length === 0) {
      return null;
    }

    const latestStatus = statuses[statuses.length - 1];

    return (
      <div>
        <div className="status-container-header">HTML Timetable Generation Status</div>
        <div className="status-container" ref={statusContainer}>
          {statuses.map((status, index) => {
            if (status.error) {
              return (
                <div className="status status-error" key={index}><strong>Error:</strong> {status.error}</div>
              );
            }

            return (
              <div className="status" key={index}>
                {formatStatusText(status.status)}
                {status.html_download_url && <div className="row mt-4 mb-4">
                  <div className="col-md-6">
                    <a
                      href={status.html_download_url}
                      className="btn btn-lg btn-primary btn-block"
                    >Download .zip</a>
                  </div>
                  <div className="col-md-6">
                    <a
                      href={status.html_preview_url}
                      className="btn btn-lg btn-primary btn-block"
                      target="_blank"
                    >Preview Timetables</a>
                  </div>
                </div>}
              </div>
            );
          })}
          {!latestStatus.html_preview_url && !latestStatus.error && <div className="spinner mb-4"></div>}
        </div>
        <style jsx>{`
          .status-container-header {
            background-color: #37373a;
            border-top: 1px solid #4e4e51;
            border-right: 1px solid #4e4e51;
            border-left: 1px solid #4e4e51;
            border-top-right-radius: 7px;
            border-top-left-radius: 7px;
            color: #b3b3b6;
            font-size: 14px;
            padding: 2px;
            text-align: center;
          }

          .status-container {
            text-align: left;
            background-color: #1e1e1e;
            color: #4AF626;
            font-family: "Courier New", Courier, "Lucida Sans Typewriter", "Lucida Typewriter", monospace;
            padding: 15px 30px;
            height: 400px;
            overflow-y: scroll;
            overflow-x: hidden;
            border-bottom-right-radius: 7px;
            border-bottom-left-radius: 7px;
            box-shadow: 0 5px 8px 0 rgba(0,0,0,0.2),0 6px 20px 0 rgba(0,0,0,0.19) !important;
          }

          .status-error {
            color: #ff3b1e;
          }

          .spinner {
            margin-top: 5px;
            margin-bottom: -15px;
            width: 1.5rem;
            height: 1.5rem;
            border: 0.25rem solid #4AF626;
            border-bottom: 0.25rem solid rgba(0,0,0,0);
            border-radius: 50%;
            animation: spin 1s linear infinite;
            z-index: 9999;
          }
          
          .spinner--hidden {
            display: none;
          }
          
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }

          @media only screen and (min-width: 800px) {
            .status-container {
              width: 700px;
            }
          }

          @media only screen and (min-width: 968px) {
            .status-container {
              width: 800px;
            }
          }
        `}</style>
      </div>
    );
  };

  return (
    <div>
      <Head>
        <title>GTFS-to-HTML: Build human readable transit timetables in HTML from GTFS</title>
        <link rel="icon" type="image/png" href="/static/favicon-16x16.png" sizes="16x16" />
        <link rel="icon" type="image/png" href="/static/favicon-32x32.png" sizes="32x32" />
        <link rel="apple-touch-icon" href="/static/apple-touch-icon.png" sizes="180x180" />
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossOrigin="anonymous" />
      </Head>
      <div className="wrapper">
        <div className="home-content">
          <div className="form-box">
            {renderUrlForm()}
            {renderLoading()}
            {renderStatus()}
          </div>
        </div>
        <div className="footer">
          Created by <a href="https://blinktag.com">BlinkTag Inc</a> | Powered by <a href="https://github.com/BlinkTagInc/gtfs-to-html">GTFS-to-HTML</a>
        </div>
      </div>
      <style jsx>{`
        body {
          position: relative;
          min-height: 100%;
          margin: 0;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
          color: #000;
        }
        h1 {
          font-weight: 400;
          font-size: 32px;
          line-height: 42px;
          text-align: center;
        }
        h2 {
          font-weight: 400;
          font-size: 28px;
          line-height: 36px;
        }
        .home-content {
          padding: 15px 20px 0;
        }
        .form-box {
          align-items: center;
        }
        .footer {
          padding: 25px;
        }
        .footer a {
          color: #000;
        }

        @media only screen and (min-width: 800px) {
          .wrapper {
            display: flex;
            align-items: center;
            flex-direction: column;
            flex: 1;
            justify-content: center;
          }
          .home-content {
            display: flex;
            flex-direction: column;
            min-height: calc(100vh - 75px);
            max-width: 800px;
          }
          .form-box {
            align-items: center;
            display: flex;
            flex-direction: column;
            flex: 1;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}

export default Home;
