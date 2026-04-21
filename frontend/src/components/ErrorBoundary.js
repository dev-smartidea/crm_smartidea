import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          fontFamily: 'sans-serif',
          textAlign: 'center',
          backgroundColor: '#f8f9fa',
        }}>
          <h2 style={{ color: '#dc3545', marginBottom: '0.5rem' }}>เกิดข้อผิดพลาดที่ไม่คาดคิด</h2>
          <p style={{ color: '#6c757d', marginBottom: '1.5rem' }}>
            กรุณาลองรีเฟรชหน้าเว็บ หากปัญหายังคงอยู่กรุณาติดต่อผู้ดูแลระบบ
          </p>
          <button
            onClick={this.handleReload}
            style={{
              padding: '0.5rem 1.5rem',
              backgroundColor: '#0d6efd',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            กลับหน้าหลัก
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
