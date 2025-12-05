import { User, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface Account {
  id: string
  fid: number
  username: string
  displayName: string | null
  pfpUrl: string | null
  isPremium?: boolean
  signerStatus?: string
}

interface AccountSelectorProps {
  accounts: Account[]
  selectedAccountId: string | null
  onSelect: (id: string) => void
  isLoading: boolean
}

export function AccountSelector({ 
  accounts, 
  selectedAccountId, 
  onSelect, 
  isLoading 
}: AccountSelectorProps) {
  return (
    <Card className="p-4">
      <label className="block text-sm font-medium text-foreground mb-3">Cuenta</label>
      {isLoading ? (
        <div className="text-center py-6">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground">
          <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No hay cuentas conectadas</p>
          <Button variant="link" asChild className="mt-1">
            <Link href="/dashboard/accounts/connect">
              Añadir cuenta
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              onClick={() => onSelect(account.id)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all duration-200",
                selectedAccountId === account.id 
                  ? "border-castor-black bg-muted ring-1 ring-castor-black/10" 
                  : "hover:border-gray-300 hover:bg-muted/50"
              )}
            >
              <span className="font-medium block truncate text-sm">
                {account.displayName || account.username}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                @{account.username}
              </span>
            </button>
          ))}
        </div>
      )}
    </Card>
  )
}
