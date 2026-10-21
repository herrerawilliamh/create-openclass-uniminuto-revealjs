import React from 'react';
import { createRoot } from 'react-dom/client';
import config from '../openclass.config.json';
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
