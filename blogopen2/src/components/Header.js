import React from 'react';

const Header = ({ onThemeToggle, onLoginClick, theme }) => {
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="nav blur">
      <div className="container nav__inner">
        <a className="logo" href="#top">BlogOpen</a>

        <nav className="menu" id="menu">
          <a href="#features" onClick={(e) => { e.preventDefault(); scrollToSection('features'); }}>
            Возможности
          </a>
          <a href="#trust" onClick={(e) => { e.preventDefault(); scrollToSection('trust'); }}>
            Trust Index
          </a>
          <a href="#how" onClick={(e) => { e.preventDefault(); scrollToSection('how'); }}>
            Как это работает
          </a>
          <a href="#pricing" onClick={(e) => { e.preventDefault(); scrollToSection('pricing'); }}>
            Тарифы
          </a>
        </nav>

        <div className="nav__actions">
          <button className="btn" id="themeBtn" type="button" aria-label="Theme" onClick={onThemeToggle}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <a className="btn btnStart" href="#start" onClick={(e) => { e.preventDefault(); onLoginClick(); }}>
            Войти
          </a>
          <button className="burger" id="burger" type="button" aria-label="Menu">
            <span></span><span></span><span></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;