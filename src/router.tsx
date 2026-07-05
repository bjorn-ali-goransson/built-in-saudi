import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RootRedirect } from './components/RootRedirect'
import { HomePage } from './pages/HomePage'
import { ToolPage } from './pages/ToolPage'
import { BookingPage } from './pages/BookingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { ErrorPage } from './components/ErrorPage'

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    // Locale-prefixed section. Layout validates :lang and redirects if invalid.
    path: '/:lang',
    element: <Layout />,
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage />, errorElement: <ErrorPage /> },
      { path: 'tools/:toolId', element: <ToolPage />, errorElement: <ErrorPage /> },
      // Public booking page. Shared as built-in-saudi.com/book/<code> — a bare
      // /book/<code> hits Layout with an invalid :lang and redirects to the
      // visitor's locale (/en|/ar), so booking links aren't language-locked.
      { path: 'book/:code', element: <BookingPage />, errorElement: <ErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
