/**
 * Entry point for the privacy policy page.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PrivacyPage } from './PrivacyPage.tsx';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('missing #root');

createRoot(container).render(
  <StrictMode>
    <PrivacyPage />
  </StrictMode>,
);
