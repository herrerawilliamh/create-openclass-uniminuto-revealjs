import React from 'react';
import { createRoot } from 'react-dom/client';
// Proyección pública de openclass.config.json (módulo virtual de vite.config.mjs).
import config from 'virtual:openclass-config';
import { Portal } from './Portal.jsx';
import { Presentacion } from './Presentacion.jsx';
import './theme.css';

const el = document.getElementById('app');
const { kind = 'portal', week = '' } = document.documentElement.dataset;
const presentationKind = document.documentElement.dataset.presentation || kind;

createRoot(el).render(kind === 'portal'
  ? <Portal config={config} />
  : <Presentacion kind={presentationKind} week={week} config={config} />
);
