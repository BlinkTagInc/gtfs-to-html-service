import { NextAdapter } from 'next-query-params';
import { QueryParamProvider } from 'use-query-params';

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <QueryParamProvider adapter={NextAdapter}>
      <Component {...pageProps} />
    </QueryParamProvider>
  );
}

export default MyApp;
