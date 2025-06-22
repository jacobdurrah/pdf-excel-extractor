import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainLayout from './components/MainLayout';
import ExtractionView from './views/ExtractionView';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<ExtractionView />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;