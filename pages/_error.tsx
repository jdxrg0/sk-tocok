import type { NextPageContext } from 'next';

function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>
        {statusCode ? `${statusCode} - Server Error` : 'An error occurred'}
      </h1>
      <p style={{ color: '#64748b', marginTop: '8px' }}>
        {statusCode === 404 ? 'This page could not be found.' : 'Something went wrong.'}
      </p>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
