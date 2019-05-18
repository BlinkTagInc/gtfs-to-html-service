import Head from 'next/head';
import { useState } from 'react';

function Home() {
  const [url, setUrl] = useState('');

  const handleUrlChange = event => setUrl(event.target.value);

  const handleUrlFormSubmit = async event => {
    event.preventDefault();
    
    if (!/^(f|ht)tps?:\/\//i.test(url)) {
      alert('Please enter a valid URL');
    }

    const res = await fetch('/api/create', { 
      method: 'POST',
      body: JSON.stringify({
        url
      }),
      headers:{
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json()

    console.log(data)
  }

  return (
    <div>
      <Head>
        <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.3.1/css/bootstrap.min.css" integrity="sha384-ggOyR0iXCbMQv3Xipma34MD+dH/1fQ784/j6cY/iJTQUOhcWr7x9JvoRxT2MZw1T" crossOrigin="anonymous" />
      </Head>
      <div className="wrapper">
        <div className="home-content">
          <div className="form-box">
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
              </div>
              <input type="submit" value="Go" className="btn btn-primary btn-lg" />
            </form>
          </div>
        </div>
        <div className="footer">
          Created by <a href="https://blinktag.com">BlinkTag Inc</a> | Powered by <a href="https://github.com/BlinkTagInc/gtfs-to-html">GTFS-to-HTML</a>
        </div>
      </div>
      <style jsx>{`
        h1 {
          font-weight: 400;
          font-size: 32px;
          line-height: 42px;
          text-align: center;
        }
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

        @media (min-width: 576px) {
          .url-form {
            width: 520px;
          }
          .form-inline .url-form-group {
            flex: 1;
          }
          .form-inline .form-control-url {
            width: 100%;
          }
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
      `}</style>
    </div>
  )
}

export default Home;
