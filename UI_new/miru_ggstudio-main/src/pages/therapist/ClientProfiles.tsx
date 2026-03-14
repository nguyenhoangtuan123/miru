import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, UserRound } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { repairMojibake } from '../../lib/text';
import { therapistClientsQueryOptions } from '../../queries/appQueries';

type TherapistClientRow = Record<string, unknown>;

function getClientId(client: TherapistClientRow) {
  const rawId = client.client_id ?? client.id;
  return typeof rawId === 'string' ? rawId : '';
}

function getNestedUser(client: TherapistClientRow) {
  if (client.users && typeof client.users === 'object') {
    return client.users as Record<string, unknown>;
  }
  if (client.user && typeof client.user === 'object') {
    return client.user as Record<string, unknown>;
  }
  return null;
}

function getClientName(client: TherapistClientRow) {
  const nested = getNestedUser(client);
  if (nested && typeof nested.name === 'string' && nested.name.trim()) {
    return nested.name;
  }
  const fallback = client.name ?? client.client_id ?? client.id;
  return typeof fallback === 'string' && fallback.trim() ? fallback : 'Than chu';
}

function getClientEmail(client: TherapistClientRow) {
  const nested = getNestedUser(client);
  if (nested && typeof nested.email === 'string' && nested.email.trim()) {
    return nested.email;
  }
  return typeof client.email === 'string' ? client.email : '';
}

function getClientPicture(client: TherapistClientRow) {
  const nested = getNestedUser(client);
  if (nested && typeof nested.picture === 'string' && nested.picture.trim()) {
    return nested.picture;
  }
  return typeof client.picture === 'string' ? client.picture : null;
}

export function TherapistClientProfilesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const clientsQuery = useQuery({
    ...therapistClientsQueryOptions(user?.id ?? ''),
    enabled: Boolean(user?.id),
  });
  const clients = (clientsQuery.data?.clients ?? []) as TherapistClientRow[];
  const loading = clientsQuery.isLoading;
  const error =
    clientsQuery.error instanceof Error ? clientsQuery.error.message : null;

  const filteredClients = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return clients;
    }
    return clients.filter((client) =>
      [getClientName(client), getClientEmail(client), getClientId(client)]
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [clients, search]);

  return (
    <div className="min-h-screen px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="glass-panel rounded-[32px] border border-white/10 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.35em] text-white/35">Client Profiles</div>
              <h1 className="mt-3 text-3xl font-bold">Ho so rieng tu cua than chu</h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/65">
                Xem nhanh ho so ma than chu da tu nguyen cap nhat. Trang nay tach rieng khoi flow homework de giam va cham.
              </p>
            </div>

            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" size={18} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Tim than chu..."
                className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-white placeholder:text-white/30 focus:border-miru-primary/50 focus:outline-none"
              />
            </label>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
            {repairMojibake(error)}
          </div>
        )}

        <div className="mt-8 grid gap-4">
          {loading
            ? Array.from({ length: 5 }).map((_, index) => (
                <div
                  key={index}
                  className="glass-panel h-24 animate-pulse rounded-[28px] border border-white/10 bg-white/5"
                />
              ))
            : filteredClients.map((client) => (
                <div
                  key={getClientId(client) || String(client.id ?? Math.random())}
                  className="glass-panel flex flex-col gap-4 rounded-[28px] border border-white/10 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    {getClientPicture(client) ? (
                      <img
                        src={String(getClientPicture(client))}
                        alt={getClientName(client)}
                        className="h-14 w-14 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-miru-primary/15 text-miru-primary">
                        <UserRound size={24} />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-semibold">
                        {repairMojibake(getClientName(client))}
                      </h2>
                      <p className="truncate text-sm text-white/55">
                        {repairMojibake(getClientEmail(client) || getClientId(client))}
                      </p>
                    </div>
                  </div>

                  <Link
                    to={`/therapist/client-profiles/${encodeURIComponent(getClientId(client))}`}
                    className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-white/10"
                  >
                    Xem ho so
                  </Link>
                </div>
              ))}
        </div>

        {!loading && filteredClients.length === 0 && (
          <div className="mt-8 rounded-[28px] border border-dashed border-white/10 px-6 py-12 text-center text-sm text-white/45">
            Chua co than chu phu hop voi bo loc hien tai.
          </div>
        )}
      </div>
    </div>
  );
}
