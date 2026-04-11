// Passthrough layout — auth is enforced in app/portal/(authenticated)/layout.tsx
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
