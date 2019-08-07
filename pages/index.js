import Head from 'next/head';
import { useState, useEffect } from 'react';
const io = require('socket.io-client');
const socket = io('http://localhost:3000');

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  )
}

function Home() {
  const [url, setUrl] = useState('');
  const [processing, setProcessing] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [buildId, setBuildId] = useState();
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  const statusContainer = React.createRef();

  useEffect(() => {
    socket.on('status', payload => {
      if (statuses.length && payload.statusKey && payload.statusKey === statuses[statuses.length - 1].statusKey) {
        statuses.splice(-1, 1, payload);
      } else {
        statuses.push(payload)
      }
      setStatuses([ ...statuses ]);
    });
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', setUserHasScrolled(true));
  }, []);

  useEffect(() => {
    if(!userHasScrolled){
      var element = statusContainer.current;
      if (element) {
        console.log('boom')
        element.scrollTop = element.scrollHeight;
      }
    }
  }, [statuses])

  const useCaltrain = event => {
    if (event) {
      event.preventDefault();
    }

    setUrl('https://transitfeeds.com/p/caltrain/122/latest/download');
  }

  const handleUrlChange = event => setUrl(event.target.value);

  const handleUrlFormSubmit = async event => {
    if (event) {
      event.preventDefault();
    }

    setStatuses([]);
    setUserHasScrolled(false);
    
    if (!/^(f|ht)tps?:\/\//i.test(url)) {
      setStatuses([{ error: 'Please enter a valid URL' }]);
      return;
    }

    setProcessing(true);

    const buildId = uuidv4();
    socket.emit('create', {
      url,
      buildId
    });

    setBuildId(buildId);
    setProcessing(false);
  }

  const renderUrlForm = () => {
    if (processing) {
      return null;
    }

    return (
      <div>
        <h1>Generate HTML timetables from your GTFS</h1>
        <form className="form-inline url-form" onSubmit={handleUrlFormSubmit}>
          <div className="form-group mx-sm-3 url-form-group">
            <input
              type="text"
              placeholder="URL of zipped GTFS file"
              className="form-control form-control-lg form-control-url"
              value={url}
              onChange={handleUrlChange}
            />
            <small 
              className="form-text text-muted"
            >
              Looking for a URL? Try <a href="https://transitfeeds.com/" target="_blank">transitfeeds.com</a> or <a href="#" onClick={useCaltrain}>try Caltrain's GTFS</a>.
            </small>
          </div>
          <input type="submit" value="Go" className="btn btn-primary btn-lg" />
        </form>

        {!statuses.length && <div className="row">
          <div className="col-sm-6 offset-sm-3 mt-5">
            <div className="card">
              <div className="card-body">
                <h5 className="card-title">What is this tool?</h5>
                <p className="card-text">GTFS-to-HTML creates human-readable, user-friendly transit timetables in HTML format directly from GTFS transit data.</p>
                <p className="card-text">Most transit agencies have schedule data in GTFS format but need to show each route's schedule to users on a website. This tool automates the process of creating nicely formatted HTML timetables for inclusion on a transit agency website. Automating timetable creation means that timetables can be kept up to date and accurate when schedule changes happen and the likelihood of errors is reduced.</p>
                <a href="https://github.com/BlinkTagInc/gtfs-to-html" className="card-link">Read more</a>
                <a href="https://gtfs.org/" className="card-link">Read more about GTFS</a>
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
  }

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
    )
  }

  const formatStatusText = text => text.replace(`${buildId}: `, '');

  const renderStatus = () => {
    if (!statuses.length) {
      return null;
    }

    const latestStatus = statuses[statuses.length - 1];

    return (
      <div>
        <h4>Status:</h4>
        <div className="status-container" ref={statusContainer}>
          {statuses.map((status, index) => {
            if (status.error) {
              return (
                <div className="status text-danger" key={index}><strong>Error:</strong> {status.error}</div>
              )
            }
            return (
              <div className="status" key={index}>
                {formatStatusText(status.status)}
              </div>
            )
          })}
          {!latestStatus.html_preview_url && !latestStatus.error && <div className="spinner"></div>}
          <div className="row mt-4">
            {latestStatus.html_download_url && <div className="col-md-6">
              <a
                href={latestStatus.html_download_url}
                className="btn btn-lg btn-primary btn-block"
              >Download .zip</a>
            </div>}
            {latestStatus.html_preview_url && <div className="col-md-6">
              <a
                href={latestStatus.html_preview_url}
                className="btn btn-lg btn-primary btn-block"
                target="_blank"
              >Preview Timetables</a>
            </div>}
          </div>
        </div>
        <style jsx>{`
          .status-container {
            width: 800px;
            text-align: left;
            background-color: #1e1e1e;
            color: #4AF626;
            font-family: "Courier New", Courier, "Lucida Sans Typewriter", "Lucida Typewriter", monospace;
            padding: 30px;
            height: 400px;
            overflow-y: scroll;
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
        `}</style>
      </div>
    );
  }

  return (
    <div>
      <Head>
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
          padding: 0 20px;
          max-width: 800px;
        }
        .form-box {
          align-items: center;
          display: flex;
          flex-direction: column;
          flex: 1;
          justify-content: center;
        }
        .footer {
          padding: 25px;
        }
        .footer a {
          color: #000;
        }
      `}</style>
      <style global jsx>{`
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
      `}</style>
    </div>
  )
}

export default Home;
