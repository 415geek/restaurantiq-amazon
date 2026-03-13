import { currentUser } from '@clerk/nextjs/server';

const BO_ADMIN_EMAIL = 'geekyiot@gmail.com';

export async function requireBoAdmin() {
  const user = await currentUser();
  if (!user) {
    return { ok: false as const, status: 401 as const, error: 'unauthorized' as const };
  }

  const email =
    user.emailAddresses.find((entry) => entry.id === user.primaryEmailAddressId)
      ?.emailAddress ||
    user.emailAddresses[0]?.emailAddress ||
    '';

  if (email.toLowerCase() !== BO_ADMIN_EMAIL) {
    return { ok: false as const, status: 403 as const, error: 'forbidden' as const };
  }

  return { ok: true as const, user, email };
}

export const boAdminEmail = BO_ADMIN_EMAIL;
