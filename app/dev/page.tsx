'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AppContext, EmbPricingInventory, RestResponse } from '@/lib/types';

interface CartData {
  cartId: string;
  grandTotal: string;
  totalProductCount: string;
  cartItems: Array<{
    cartItemId: string;
    sku: string;
    name: string;
    quantity: string;
    totalPrice: string;
  }>;
}

const PERSONAS = ['cso', 'dso', 'csa'] as const;
const DEMO_SKUS = ['PART-1001', 'PART-2002', 'PART-3003'];

function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : '';
}

async function getJson<T>(url: string): Promise<RestResponse<T>> {
  return (await fetch(url, { credentials: 'same-origin' })).json();
}
async function postJson<T>(url: string, body: unknown, csrf = false): Promise<RestResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (csrf) headers['x-csrf-token'] = getCookie('on_csrf');
  return (
    await fetch(url, {
      method: 'POST',
      headers,
      credentials: 'same-origin',
      body: JSON.stringify(body),
    })
  ).json();
}

export default function Home() {
  const [persona, setPersona] = useState<string>('cso');

  // 1. Establish a (mock) session for the selected persona — gates the rest.
  const session = useQuery({
    queryKey: ['session', persona],
    queryFn: () => postJson<{ role: string }>('/api/v1/auth/dev-login', { persona }),
  });
  const ready = session.isSuccess;

  // 2-4. Dependent calls, each exercising the real BFF route → client → MSW path.
  const context = useQuery({
    queryKey: ['context', persona],
    queryFn: () => getJson<AppContext>('/api/v1/context'),
    enabled: ready,
  });
  const cart = useQuery({
    queryKey: ['cart', persona],
    queryFn: () => getJson<CartData>('/api/v1/cart'),
    enabled: ready,
  });
  const pricing = useQuery({
    queryKey: ['pricing', persona],
    queryFn: () =>
      postJson<EmbPricingInventory>('/api/v1/pricing-inventory', { skus: DEMO_SKUS }, true),
    enabled: ready,
  });

  const ctx = context.data?.data;
  const cartData = cart.data?.data;
  const pricingData = pricing.data?.data;
  const busy = session.isFetching || context.isFetching || cart.isFetching || pricing.isFetching;

  return (
    <main style={{ maxWidth: 920, margin: '0 auto', padding: '32px 20px' }}>
      <h1 style={{ marginBottom: 4 }}>OrderNow — Headless Storefront</h1>
      <p style={{ color: '#555', marginTop: 0 }}>
        Local <strong>mock mode</strong>: every call below traverses the real BFF route → client →
        MSW. No Salesforce, EMB, Azure, or Redis required.
      </p>

      <section style={{ margin: '20px 0' }}>
        <label style={{ marginRight: 8 }}>Persona:</label>
        {PERSONAS.map((p) => (
          <button
            key={p}
            onClick={() => setPersona(p)}
            disabled={busy}
            style={{
              marginRight: 8,
              padding: '6px 12px',
              cursor: 'pointer',
              fontWeight: persona === p ? 700 : 400,
              border: '1px solid #999',
              borderRadius: 6,
              background: persona === p ? '#e8f0fe' : '#fff',
            }}
          >
            {p.toUpperCase()}
          </button>
        ))}
        {busy && <span style={{ marginLeft: 12, color: '#888' }}>loading…</span>}
      </section>

      {ctx && (
        <Card title="Context (BFF-resolved)">
          <Row
            k="User"
            v={`${ctx.user.firstName} ${ctx.user.lastName} (${ctx.user.companyName})`}
          />
          <Row
            k="Role / Customer type"
            v={`${ctx.role?.toUpperCase() ?? 'UNRESOLVED'} · ${ctx.customerType || 'unresolved'}`}
          />
          <Row k="Effective account" v={ctx.effectiveAccountId} />
          <Row k="Webstore" v={ctx.webstoreId} />
          <Row
            k="Permissions"
            v={Object.entries(ctx.permissions)
              .filter(([, v]) => v)
              .map(([k]) => k)
              .join(', ')}
          />
        </Card>
      )}

      {cartData && (
        <Card title={`Cart — $${cartData.grandTotal} (${cartData.totalProductCount} items)`}>
          {cartData.cartItems.map((it) => (
            <Row
              key={it.cartItemId}
              k={`${it.sku} ×${it.quantity}`}
              v={`${it.name} — $${it.totalPrice}`}
            />
          ))}
        </Card>
      )}

      {pricingData && (
        <Card title="Pricing & inventory (EMB)">
          {Object.entries(pricingData.products).map(([sku, p]) => (
            <Row
              key={sku}
              k={sku}
              v={
                p.available
                  ? `$${p.price} · ${p.quantity} in stock`
                  : `$${p.price ?? '—'} · ${p.message || 'unavailable'}`
              }
            />
          ))}
        </Card>
      )}
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, margin: '12px 0' }}>
      <h2 style={{ fontSize: 15, margin: '0 0 10px', color: '#1b263b' }}>{title}</h2>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 14, padding: '2px 0' }}>
      <span style={{ minWidth: 200, color: '#666' }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
