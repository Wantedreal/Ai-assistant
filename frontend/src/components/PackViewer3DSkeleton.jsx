// Skeleton loader for 3D viewer while component loads
export default function PackViewer3DSkeleton() {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      minHeight: '300px',
      backgroundColor: '#1a1c23',
      borderRadius: 'inherit',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative'
    }}>
      {/* Animated gradient background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'linear-gradient(90deg, #2a2c33 0%, #3a3c43 50%, #2a2c33 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite',
      }} />

      {/* Loading message */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        textAlign: 'center',
        color: '#fff',
      }}>
        <div style={{
          fontSize: '2rem',
          marginBottom: '16px',
          animation: 'pulse 1.5s ease-in-out infinite'
        }}>
          🔋
        </div>
        <div style={{
          fontSize: '0.9rem',
          color: '#999',
          fontWeight: 500
        }}>
          Loading 3D Viewer...
        </div>
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.1); }
        }
      `}</style>
    </div>
  )
}
