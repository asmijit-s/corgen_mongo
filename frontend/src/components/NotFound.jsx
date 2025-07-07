import React from 'react';
import './css/ErrorPage.css';

const NotFoundPage = () => {
  return (
    <div className="error-container-404">
      <div className="error-content-404">
        <div className="error-code-404">404</div>
        <h1 className="error-title-404">Page Not Found</h1>
        <p className="error-message-404">
          Oops! The page you're looking for doesn't exist or has been moved.
        </p>
        <p 
          className="home-btn-404"
        >
          Return to desired page using Course Generation Progress Panel
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;