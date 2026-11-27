import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root.tsx';
import './styles.css';

const el = document.getElementById('root');
if (el === null) throw new Error('#root element missing');
createRoot(el).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
