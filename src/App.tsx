import { NavLink, Route, Routes } from 'react-router-dom';
import { isMock } from './api/client';
import SettingsBar from './components/SettingsBar';
import Catalog from './pages/Catalog';
import ItemPage from './pages/ItemPage';
import TopCrafts from './pages/TopCrafts';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="brand">⚙ Крафт и рынок</div>
        <nav>
          <NavLink to="/" end>Каталог</NavLink>
          <NavLink to="/top">Выгодные крафты</NavLink>
        </nav>
      </header>
      {isMock && <div className="banner">Тестовый режим: показаны выдуманные данные, а не реальный рынок.</div>}
      <SettingsBar />
      <main>
        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/top" element={<TopCrafts />} />
          <Route path="/item/:id" element={<ItemPage />} />
          <Route path="*" element={<p>Страница не найдена.</p>} />
        </Routes>
      </main>
      <footer className="footer">
        Данные рынка: <a href="https://crossoutdb.com" target="_blank" rel="noreferrer">CrossoutDB</a>.
        Неофициальный фанатский сайт, не связан с разработчиками игры.
      </footer>
    </div>
  );
}
