import React, { useEffect, useState } from 'react';

const Footer = () => {
  const [year, setYear] = useState('');

  useEffect(() => {
    setYear(new Date().getFullYear());
  }, []);

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="muted">© {year} BlogOpen</div>
        <div className="muted">Политика • Контакты</div>
      </div>
    </footer>
  );
};

export default Footer;