import { render } from 'solid-js/web';
import { App } from './app/App';
import './styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) {
  throw new Error('Root element #root not found');
}

render(() => <App />, root);
