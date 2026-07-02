import { createBrowserRouter } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RootRedirect } from './components/RootRedirect'
import { HomePage } from './pages/HomePage'
import { ToolPage } from './pages/ToolPage'
import { NotFoundPage } from './pages/NotFoundPage'

export const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  {
    // Locale-prefixed section. Layout validates :lang and redirects if invalid.
    path: '/:lang',
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'tools/:toolId', element: <ToolPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
