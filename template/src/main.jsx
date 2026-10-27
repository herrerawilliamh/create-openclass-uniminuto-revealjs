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

// Build Tech (?oc-vista=build-tech): vista privada del docente, abierta desde «Vista del presentador» de esta misma
// presentación. No monta el deck: lo controla por el puente local (src/plugins/puente.mjs).
const buildTech = kind !== 'portal' && new URLSearchParams(location.search).get('oc-vista') === 'build-tech';

if (buildTech) import('./buildtech/vista.mjs').then(({ montarBuildTech }) => montarBuildTech(el));
else createRoot(el).render(kind === 'portal'
  ? <Portal config={config} />
  : <Presentacion kind={presentationKind} week={week} config={config} />
);
