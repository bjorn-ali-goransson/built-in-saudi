import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RootRedirect } from './components/RootRedirect'
import { HomePage } from './pages/HomePage'
import { ToolPage } from './pages/ToolPage'
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
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
