import { AccountClient } from '@/components/account/AccountClient';
import { AccountMockClient } from '@/components/account/AccountMockClient';

const authDisabled = process.env.NEXT_PUBLIC_USE_MOCK_DATA === 'true' || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function AccountPage() {
  if (authDisabled) {
    return <AccountMockClient />;
  }

  return <AccountClient />;
}
