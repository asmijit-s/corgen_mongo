import React from 'react';
import { Link } from 'react-router-dom'; // If you're using React Router
import './css/Navbar.css'; // You can place the CSS in a separate file

const Navbar = () => {
  return (
    <header className="header">
      <nav className="nav">
        <div className="logo">
          Saras AI Institute
        </div>
        <div className="nav-links">
          {/* If using React Router */}
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/get-started" className="get-started-btn">Get Started</Link>
          
          {/* If not using React Router */}
          {/* <a href="#home">Home</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
          <a href="#get-started" className="get-started-btn">Get Started</a> */}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;