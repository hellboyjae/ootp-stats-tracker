import React from 'react'
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { AppContent } from './App.jsx'

export function render(url) {
  return renderToString(
    <StaticRouter location={url}>
      <AppContent />
    </StaticRouter>
  )
}
