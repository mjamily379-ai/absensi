import React from 'react';
import './Footer.css';

const Footer: React.FC = () => {
  return (
    <footer className="footer">
      <p>&copy; {new Date().getFullYear()} An Najiyah Al-Islamiyah</p>
    </footer>
  );
};

export default Footer;