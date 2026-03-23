import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1a1c23',
          color: '#999',
          textAlign: 'center',
          padding: '20px',
          minHeight: '300px',
          borderRadius: 'inherit',
          flexDirection: 'column',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '10px' }}>⚠️</div>
          <div style={{ fontSize: '14px', marginBottom: '8px' }}>Component Error</div>
          <div style={{ fontSize: '12px', color: '#666', maxWidth: '300px' }}>
            {this.state.error?.message || 'An unexpected error occurred'}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: '12px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
