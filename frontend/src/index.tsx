import '@i18n/i18n';
import './styles/index.css';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import routes from 'src/configs/routesConfig';

const container = document.getElementById('app');

if (!container) {
	throw new Error('Failed to find the root element');
}

const root = createRoot(container, {
	onUncaughtError: (error, errorInfo) => {
		console.error('UncaughtError error', error, errorInfo.componentStack);
	},
	onCaughtError: (error, errorInfo) => {
		console.error('Caught error', error, errorInfo.componentStack);
	}
});

const router = createBrowserRouter(routes);

root.render(<RouterProvider router={router} />);
