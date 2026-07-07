import { createBrowserRouter, Navigate, useParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RootRedirect } from './components/RootRedirect'
import { HomePage } from './pages/HomePage'
import { ToolPage } from './pages/ToolPage'
import { BookingPage } from './pages/BookingPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { TermsPage } from './pages/TermsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ErrorPage } from './components/ErrorPage'

/** Redirect legacy /:lang/tools/:id links to the new /:lang/apps/:id. */
function AppsRedirect() {
  const { lang, toolId } = useParams()
  return <Navigate to={`/${lang}/apps/${toolId}`} replace />
}

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    // Locale-prefixed section. Layout validates :lang and redirects if invalid.
    path: '/:lang',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage />, errorElement: <ErrorPage /> },
      { path: 'apps/:toolId', element: <ToolPage />, errorElement: <ErrorPage /> },
      { path: 'tools/:toolId', element: <AppsRedirect /> },
      // Public booking page. Shared as built-in-saudi.com/book/<code> — a bare
      // /book/<code> hits Layout with an invalid :lang and redirects to the
      // visitor's locale (/en|/ar), so booking links aren't language-locked.
      { path: 'book/:code', element: <BookingPage />, errorElement: <ErrorPage /> },
      { path: 'privacy', element: <PrivacyPage />, errorElement: <ErrorPage /> },
      { path: 'terms', element: <TermsPage />, errorElement: <ErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
