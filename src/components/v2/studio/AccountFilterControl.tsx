'use client'

type AccountFilterControlProps = {
  accountFilter: string
  onChange: (value: string) => void
  accounts: Array<{ id: string; username: string }>
}

export function AccountFilterControl({ accountFilter, onChange, accounts }: AccountFilterControlProps) {
  return (
    <label className="text-xs text-muted-foreground flex items-center gap-2">
      Account
      <select
        aria-label="Filter studio panels by account"
        className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
        value={accountFilter}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="all">All accounts</option>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            @{account.username}
          </option>
        ))}
      </select>
    </label>
  )
}
