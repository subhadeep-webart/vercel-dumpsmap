import { AdminProvider } from '@/components/admin/AdminContext'
import AdminShell from '@/components/admin/AdminShell'

export default function AdminLayout({ children }) {
  return (
    <AdminProvider>
      <AdminShell>{children}</AdminShell>
    </AdminProvider>
  )
}
