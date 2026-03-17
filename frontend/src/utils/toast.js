import React from 'react';
import ReactDOM from 'react-dom/client';
import { CheckCircleFill, ExclamationTriangleFill, XCircleFill, X } from 'react-bootstrap-icons';

let toastRoot = null;
let toasts = [];
let toastId = 0;

function renderToasts() {
  if (!toastRoot) {
    const container = document.createElement('div');
    container.id = 'toast-root';
    document.body.appendChild(container);
    toastRoot = ReactDOM.createRoot(container);
  }

  toastRoot.render(
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(t => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span className="toast-icon">
            {t.type === 'success' && <CheckCircleFill />}
            {t.type === 'error' && <XCircleFill />}
            {t.type === 'warning' && <ExclamationTriangleFill />}
          </span>
          <span className="toast-message">{t.message}</span>
          <button className="toast-close" onClick={() => removeToast(t.id)} aria-label="ปิด">
            <X />
          </button>
        </div>
      ))}
    </div>
  );
}

function removeToast(id) {
  toasts = toasts.filter(t => t.id !== id);
  renderToasts();
}

function showToast(message, type = 'success', duration = 3000) {
  const id = ++toastId;
  toasts.push({ id, message, type });
  renderToasts();
  if (duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
}

export const toast = {
  success: (msg, duration) => showToast(msg, 'success', duration),
  error: (msg, duration) => showToast(msg, 'error', duration),
  warning: (msg, duration) => showToast(msg, 'warning', duration),
};

export default toast;
